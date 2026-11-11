import type { CodeNote, KanbanNote, Note, TextNote, TodoNote } from "@/types";
import { formatToPlainText } from "@/utils/string";

const has = (value: string | undefined, text: string) => !!value && value.toLowerCase().includes(text);

/**
 * Whether a note matches the deep search. `text` is already trimmed and lower-cased; an empty one matches everything.
 * It looks at the title and at what each type holds: a text's words (without markup), a list's items, a board's column
 * names and cards, a code note's tab names and code. A type it doesn't know matches by its title only.
 */
export function matchesDeepSearch(note: Note, text: string): boolean {
  if (!text) return true;
  if (has(note.title, text)) return true;

  switch (note.type || "text") {
    case "text":
      return formatToPlainText(((note as TextNote).text ?? "").toLowerCase()).includes(text);
    case "todo":
      return !!(note as TodoNote).list?.some((item) => has(item.text, text));
    case "kanban":
      return !!(note as KanbanNote).columns?.some(
        (column) => has(column.name, text) || !!column.items?.some((item) => has(item.text, text))
      );
    case "code":
      return !!(note as CodeNote).tabs?.some((tab) => has(tab.title, text) || has(tab.code, text));
    default:
      return false;
  }
}
