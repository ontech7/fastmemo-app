import type { Note } from "@/types";
import { isKnownNoteType } from "@/utils/noteType";

import { fold } from "./fold";
import { tagsIn } from "./tags";
import type { Tag } from "./tags";

/** One line of what a note says. */
export interface NoteLine {
  text: string;
  /** A board card's column name. */
  label?: string;
  /** A line of code. */
  mono?: boolean;
  /** The code tab the line is in. */
  tabId?: string;
}

/** What the search reads of a note. A protected note's has its title only. */
export interface NoteDoc {
  title: string;
  foldedTitle: string;
  lines: NoteLine[];
  /** `fold` of each line's text, same index. */
  folded: string[];
  tags: Tag[];
}

/** The tags whose start and end break a line. */
const BLOCK_TAGS = new Set(["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote", "ul", "ol", "tr"]);
const BREAK_TAGS = new Set(["br", "hr"]);
/** Tags whose content is not text. */
const SKIPPED_TAGS = new Set(["script", "style"]);
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " " };
/** The longest entity read, "&#x10FFFF;" or a named one. */
const ENTITY_MAX = 10;

const isNameChar = (code: number) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const isLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/** The index just after the ">" that ends the tag whose name ends at `from`; quoted values may hold a ">". */
function tagEnd(html: string, from: number): number {
  let i = from;
  while (i < html.length) {
    const char = html[i];
    if (char === '"' || char === "'") {
      const close = html.indexOf(char, i + 1);
      if (close < 0) return html.length;
      i = close + 1;
    } else if (char === ">") {
      return i + 1;
    } else {
      i++;
    }
  }
  return html.length;
}

/** The index just after `</name ...>` (any case), from `from`; the end of the text when there is none. */
function closingTagEnd(html: string, name: string, from: number): number {
  let i = html.indexOf("</", from);
  while (i >= 0) {
    if (html.slice(i + 2, i + 2 + name.length).toLowerCase() === name && !isNameChar(html.charCodeAt(i + 2 + name.length))) {
      return tagEnd(html, i + 2 + name.length);
    }
    i = html.indexOf("</", i + 2);
  }
  return html.length;
}

/** The entity at `at` ("&...;") decoded, with its length; null when it isn't one this reads. */
function entityAt(html: string, at: number): { text: string; length: number } | null {
  const end = html.indexOf(";", at + 1);
  if (end < 0 || end - at > ENTITY_MAX) return null;
  const body = html.slice(at + 1, end);
  if (body[0] === "#") {
    const hex = body[1] === "x" || body[1] === "X";
    const digits = body.slice(hex ? 2 : 1);
    if (!digits || !(hex ? /^[0-9a-f]+$/i : /^[0-9]+$/).test(digits)) return null;
    const code = parseInt(digits, hex ? 16 : 10);
    if (code > 0x10ffff) return null;
    return { text: String.fromCodePoint(code), length: end - at + 1 };
  }
  const named = NAMED_ENTITIES[body];
  return named === undefined ? null : { text: named, length: end - at + 1 };
}

/**
 * A text note's lines as they read: no markup, entities decoded, pictures skipped, empty lines dropped. One pass with no
 * regular expression over the whole text: a 300 KB picture inside a tag is stepped over, never copied.
 */
export function htmlLines(html: string): string[] {
  const lines: string[] = [];
  let line = "";
  let insidePre = 0;
  const endLine = () => {
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean) lines.push(clean);
    line = "";
  };

  let i = 0;
  let textStart = 0;
  const takeText = (until: number) => {
    if (until > textStart) line += html.slice(textStart, until);
  };
  while (i < html.length) {
    const code = html.charCodeAt(i);
    if (code === 60 /* < */) {
      if (html.startsWith("<!--", i)) {
        takeText(i);
        const close = html.indexOf("-->", i + 4);
        i = textStart = close < 0 ? html.length : close + 3;
        continue;
      }
      const closing = html.charCodeAt(i + 1) === 47; /* / */
      const nameStart = i + (closing ? 2 : 1);
      const next = html.charCodeAt(nameStart);
      if (next === 33 /* ! */ || next === 63 /* ? */) {
        takeText(i);
        i = textStart = tagEnd(html, nameStart);
        continue;
      }
      if (!isLetter(next)) {
        i++; // a "<" that starts no tag is text
        continue;
      }
      takeText(i);
      let nameEnd = nameStart;
      while (nameEnd < html.length && isNameChar(html.charCodeAt(nameEnd))) nameEnd++;
      const name = html.slice(nameStart, nameEnd).toLowerCase();
      let after = tagEnd(html, nameEnd);
      if (!closing && SKIPPED_TAGS.has(name)) after = closingTagEnd(html, name, after);
      if (BLOCK_TAGS.has(name) || BREAK_TAGS.has(name)) endLine();
      if (name === "pre") insidePre = closing ? Math.max(0, insidePre - 1) : insidePre + 1;
      i = textStart = after;
      continue;
    }
    if (code === 38 /* & */) {
      const entity = entityAt(html, i);
      if (entity) {
        takeText(i);
        line += entity.text;
        i = textStart = i + entity.length;
        continue;
      }
    } else if (code === 10 /* \n */ && insidePre) {
      takeText(i);
      endLine();
      i = textStart = i + 1;
      continue;
    }
    i++;
  }
  takeText(html.length);
  endLine();
  return lines;
}

/** A plain text split on its line breaks, each part trimmed, empty ones dropped. */
function textLines(text: unknown): string[] {
  if (typeof text !== "string") return [];
  return text
    .normalize("NFC")
    .split(/\r?\n|\r/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const nfc = (text: unknown) => (typeof text === "string" ? text.normalize("NFC") : "");

/** The lines of what a note says, per type. Never called for a protected note. */
function contentLines(note: Note): NoteLine[] {
  const lines: NoteLine[] = [];
  const type = note.type as string | undefined;
  if (type === undefined || type === "" || type === "text") {
    const html = (note as { text?: unknown }).text;
    if (typeof html === "string") for (const text of htmlLines(html.normalize("NFC"))) lines.push({ text });
  } else if (type === "todo") {
    const list = (note as { list?: unknown }).list;
    if (Array.isArray(list)) for (const item of list) for (const text of textLines(item?.text)) lines.push({ text });
  } else if (type === "kanban") {
    const columns = (note as { columns?: unknown }).columns;
    if (Array.isArray(columns)) {
      for (const column of columns) {
        const name = nfc(column?.name).trim();
        if (name) lines.push({ text: name });
        if (!Array.isArray(column?.items)) continue;
        for (const item of column.items) for (const text of textLines(item?.text)) lines.push({ text, label: name });
      }
    }
  } else if (type === "code") {
    const tabs = (note as { tabs?: unknown }).tabs;
    if (Array.isArray(tabs)) {
      for (const tab of tabs) {
        const tabId = typeof tab?.id === "string" ? tab.id : undefined;
        const title = nfc(tab?.title).trim();
        if (title) lines.push({ text: title, tabId });
        for (const text of textLines(tab?.code)) lines.push({ text, mono: true, tabId });
      }
    }
  }
  return lines;
}

/**
 * What the search reads of a note: its title, its lines and its tags. A protected note gives its title alone, and its
 * content is never read; a type this version doesn't know, its title alone too. Tags come from the title, and from the
 * lines of a text note, a list or a board (never from code).
 */
export function noteDoc(note: Note): NoteDoc {
  const title = nfc(note.title);
  const readable = !note.locked && isKnownNoteType(note.type);
  const lines = readable ? contentLines(note) : [];

  const tags: Tag[] = [];
  const seen = new Set<string>();
  const addTags = (text: string) => {
    for (const tag of tagsIn(text)) {
      if (seen.has(tag.key)) continue;
      seen.add(tag.key);
      tags.push(tag);
    }
  };
  addTags(title);
  if (readable && note.type !== "code") for (const line of lines) addTags(line.text);

  return { title, foldedTitle: fold(title), lines, folded: lines.map((line) => fold(line.text)), tags };
}
