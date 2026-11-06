import { stripHtml } from "@/libs/ai/helpers";
import { noteRev } from "@/libs/cloud/revision";
import type { Note } from "@/types";

/*
 * A note as an agent sees it. These functions take the note they're given: which notes may get here is `policy.ts`'s.
 */

/** The most a read returns at a time, in characters. */
export const READ_LIMIT = 100_000;
export const IMAGE_PLACEHOLDER = "[image]";

const SNIPPET_LENGTH = 200;
/** How much of the text comes before a match in a snippet. */
const SNIPPET_LEAD = 60;

/** A whole image tag. Its attributes are read one by one: a `>` may sit inside a quoted value. */
const IMAGE_TAG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

/** The HTML with a placeholder for each image: a note's images are `data:` URLs that can fill most of it (ADR-024). */
export function withoutImageData(html: string): string {
  return html.replace(IMAGE_TAG, IMAGE_PLACEHOLDER);
}

/** `index`, or one earlier if a cut there would split an emoji in two: half of one isn't text. */
const cutPoint = (text: string, index: number): number => {
  const before = text.charCodeAt(index - 1);
  return before >= 0xd800 && before <= 0xdbff ? index - 1 : index;
};

/** What the note holds, as read: its HTML, or for the other types the JSON of what `edit_note` works on, ids included. */
const noteContent = (note: Note): string => {
  switch (note.type) {
    case "todo":
      return JSON.stringify(note.list ?? []);
    case "kanban":
      return JSON.stringify(note.columns ?? []);
    case "code":
      return JSON.stringify(note.tabs ?? []);
    default:
      return withoutImageData(note.text ?? "");
  }
};

/** The words a search looks in, as the user sees them: never tags, image data, or the keys of the JSON a read returns. */
export function noteSearchText(note: Note): string {
  switch (note.type) {
    case "todo":
      return (note.list ?? []).map((item) => item.text).join("\n");
    case "kanban":
      return (note.columns ?? [])
        .flatMap((column) => [column.name, ...(column.items ?? []).map((item) => item.text)])
        .join("\n");
    case "code":
      return (note.tabs ?? []).flatMap((tab) => [tab.title, tab.code]).join("\n");
    default:
      return stripHtml(withoutImageData(note.text ?? ""));
  }
}

const snippetOf = (text: string, query: string): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const match = query ? flat.toLowerCase().indexOf(query) : -1;
  const start = match > SNIPPET_LEAD ? cutPoint(flat, match - SNIPPET_LEAD) : 0;
  const end = cutPoint(flat, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
};

/** What every answer says about a note. The default category is `null`: "All" isn't a name `list_categories` gives. */
const noteHeader = (note: Note) => ({
  id: note.id,
  title: note.title,
  type: note.type ?? "text",
  category: !note.category || note.category.icon === "none" ? null : note.category.name,
  updatedAt: new Date(Number(note.updatedAt) || 0).toISOString(),
  important: !!note.important,
  readOnly: !!note.readOnly,
});

/** A search result. `query` is the lowercase text searched for, if any. */
export function noteSummary(note: Note, query: string): object {
  return { ...noteHeader(note), snippet: snippetOf(noteSearchText(note), query) };
}

/** A note as read: its revision, and `READ_LIMIT` characters of its content from `offset`, with where the next part starts. */
export function noteForAgent(note: Note, offset: number): object {
  const content = noteContent(note);
  const start = Math.max(0, offset);
  const end = cutPoint(content, start + READ_LIMIT);
  return {
    ...noteHeader(note),
    rev: noteRev(note),
    content: content.slice(start, end),
    ...(end < content.length && { nextOffset: end }),
  };
}
