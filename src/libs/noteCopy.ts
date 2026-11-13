import type { Note } from "@/types";
import { isKnownNoteType } from "@/utils/noteType";

/** What a copy is made with: its id, the time and date it is made, and a source of ids for what is inside it. */
export interface CopyFresh {
  id: string;
  now: number;
  date: string;
  newId: () => string;
}

/** The suffix the app already gives a note published again as a new one. */
const COPY_SUFFIX = " (2)";

/**
 * A copy of a note that shares nothing with the original: new ids for it and for every item, column, card and tab, its
 * title followed by " (2)", made now. It keeps what guards the original and where it lives (protected, hidden, offline, its
 * category, a list's mode and hidden done items), and drops what belonged to the original alone (important, read only,
 * its revisions and its reminder). null for a type this version doesn't know.
 */
export function copyOfNote(note: Note, fresh: CopyFresh): Note | null {
  if (!isKnownNoteType(note.type)) return null;

  const {
    rev: _rev,
    syncedRev: _syncedRev,
    deletedAt: _deletedAt,
    remindAt: _remindAt,
    ...kept
  } = note as Note & { remindAt?: number };
  // Notes are plain data: a JSON round trip copies every field, nested ones included.
  const copy = JSON.parse(JSON.stringify(kept)) as Note & Record<string, any>;

  const title = typeof note.title === "string" ? note.title : "";
  copy.id = fresh.id;
  copy.title = title ? title + COPY_SUFFIX : "";
  copy.createdAt = fresh.now;
  // One more than its creation, as the quick note does: the editors don't take it for a note being created.
  copy.updatedAt = fresh.now + 1;
  copy.date = fresh.date;
  copy.important = false;
  copy.readOnly = false;
  copy.deleteDate = null;

  if (Array.isArray(copy.list)) {
    for (const item of copy.list) item.id = fresh.newId();
  }
  if (Array.isArray(copy.columns)) {
    for (const column of copy.columns) {
      column.id = fresh.newId();
      if (Array.isArray(column.items)) for (const card of column.items) card.id = fresh.newId();
    }
  }
  if (Array.isArray(copy.tabs)) {
    let active: string | undefined;
    for (const tab of copy.tabs) {
      const id = fresh.newId();
      if (tab.id === copy.activeTabId) active = id;
      tab.id = id;
    }
    copy.activeTabId = active ?? copy.tabs[0]?.id ?? "";
  }
  return copy;
}
