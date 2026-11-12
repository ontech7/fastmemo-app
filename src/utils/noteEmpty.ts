import type { KanbanNote, TodoNote } from "@/types";
import { isStringEmpty } from "@/utils/string";

/*
 * Whether a note holds nothing worth keeping: no title and nothing typed. Its editor deletes such a note when it closes,
 * so a list or a board opened and left (or filled with empty rows or cards only) doesn't stay in the home as a dead note.
 */

export const isTodoNoteEmpty = (n: Pick<TodoNote, "title" | "list">) => {
  const noTitle = isStringEmpty(n.title);
  // Rows never typed into count as none, however many were added (as a board's blank cards).
  const noListItems = (n.list ?? []).every((item) => isStringEmpty(item.text));
  return noTitle && noListItems;
};

export const isKanbanNoteEmpty = (n: Pick<KanbanNote, "title" | "columns">) => {
  const noTitle = isStringEmpty(n.title);
  const noColumns = !n.columns?.length;
  // A column holding only blank cards counts as having no cards, so a fresh note whose default empty card was never
  // typed into still trashes itself on exit.
  const noCards = n.columns?.every((col) => (col.items ?? []).every((item) => isStringEmpty(item.text)));
  return noTitle && (noColumns || noCards);
};
