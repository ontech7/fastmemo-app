import { launchUrl } from "@/libs/launch/parse";
import { htmlLineParts } from "@/libs/search/lines";
import type { Note, NoteType } from "@/types";
import { isKnownNoteType } from "@/utils/noteType";

/*
 * What a widget shows (spec D.6, ADR-045): a small copy of the chosen note, made here and written for the widget, which
 * never reads the notes. A protected or hidden note, one in the trash, or of a type this version doesn't know, gives no
 * copy at all: none of its words leave the app.
 */

export interface WidgetLine {
  text: string;
  box?: "empty" | "done";
  mono?: boolean;
}

export interface WidgetSnapshot {
  noteId: string;
  type: NoteType;
  title: string;
  lines: WidgetLine[];
  /** Lines not shown. */
  more: number;
}

/** Everything a widget draws: the snapshot and the texts in the app's language. */
export interface WidgetState {
  featured: WidgetSnapshot | null;
  labels: { newNote: string; newList: string; dictate: string; emptyTitle: string; emptyText: string; noTitle: string };
  links: { newText: string; newList: string; dictate: string; note: string | null; app: string };
}

export const WIDGET_LINES = 6;
export const WIDGET_LINE_MAX = 80;

/** Whether a widget may show this note: live, not protected, not hidden, of a type this version knows. */
export function canFeature(note: Note | undefined): note is Note {
  return !!note && note.deleteDate == null && !note.locked && !note.hidden && isKnownNoteType(note.type);
}

/** At most `WIDGET_LINE_MAX` characters (code points), "…" after a cut one. */
const cut = (text: string): string => {
  const chars = Array.from(text);
  return chars.length > WIDGET_LINE_MAX ? chars.slice(0, WIDGET_LINE_MAX).join("") + "…" : text;
};

/** A plain text's lines, empty ones dropped; trimmed, or only at the end for code (its indentation is kept). */
const plainLines = (text: unknown, keepIndent = false): string[] =>
  typeof text === "string"
    ? text
        .normalize("NFC")
        .split(/\r?\n|\r/)
        .map((part) => (keepIndent ? part.trimEnd() : part.trim()))
        .filter((part) => part.trim() !== "")
    : [];

/** Every line of the note, in order, before the count. */
function noteLines(note: Note): WidgetLine[] {
  const type = note.type as string | undefined;
  if (type === undefined || type === "" || type === "text") {
    const html = (note as { text?: unknown }).text;
    return typeof html === "string" ? htmlLineParts(html.normalize("NFC")) : [];
  }
  if (type === "todo") {
    const list = (note as { list?: unknown; hideDone?: boolean }).list;
    const hideDone = (note as { hideDone?: boolean }).hideDone === true;
    if (!Array.isArray(list)) return [];
    const lines: WidgetLine[] = [];
    for (const item of list) {
      const done = item?.checked === true;
      if (done && hideDone) continue;
      const [first] = plainLines(item?.text);
      if (first) lines.push({ text: first, box: done ? "done" : "empty" });
    }
    return lines;
  }
  if (type === "kanban") {
    const columns = (note as { columns?: unknown }).columns;
    if (!Array.isArray(columns)) return [];
    return columns.map((column) => {
      const name = typeof column?.name === "string" ? column.name.normalize("NFC").trim() : "";
      const count = Array.isArray(column?.items) ? column.items.length : 0;
      return { text: name ? `${name} · ${count}` : String(count) };
    });
  }
  if (type === "code") {
    const tabs = (note as { tabs?: unknown }).tabs;
    if (!Array.isArray(tabs) || tabs.length === 0) return [];
    const activeTabId = (note as { activeTabId?: unknown }).activeTabId;
    const tab = tabs.find((candidate) => candidate?.id === activeTabId) ?? tabs[0];
    return plainLines(tab?.code, true).map((text) => ({ text, mono: true }));
  }
  return [];
}

/** null for a note a widget must not show. */
export function widgetSnapshot(note: Note | undefined): WidgetSnapshot | null {
  if (!canFeature(note)) return null;
  const all = noteLines(note);
  const lines = all.slice(0, WIDGET_LINES).map((line) => ({ ...line, text: cut(line.text) }));
  return {
    noteId: note.id,
    type: (note.type || "text") as NoteType,
    title: typeof note.title === "string" ? note.title : "",
    lines,
    more: all.length - lines.length,
  };
}

/** The whole state for the widgets: the chosen note's copy (or none), the texts, the links (`launchUrl`, this build's scheme). */
export function widgetState(note: Note | undefined, t: (key: string) => string, scheme: string): WidgetState {
  const featured = widgetSnapshot(note);
  return {
    featured,
    labels: {
      newNote: t("widget.new_note"),
      newList: t("widget.new_list"),
      dictate: t("widget.dictate"),
      emptyTitle: t("widget.empty_title"),
      emptyText: t("widget.empty_text"),
      noTitle: t("empty_title"),
    },
    links: {
      newText: launchUrl(scheme, { kind: "new", type: "text" }),
      newList: launchUrl(scheme, { kind: "new", type: "todo" }),
      dictate: launchUrl(scheme, { kind: "dictate" }),
      note: featured ? launchUrl(scheme, { kind: "note", id: featured.noteId }) : null,
      app: `${scheme}://`,
    },
  };
}
