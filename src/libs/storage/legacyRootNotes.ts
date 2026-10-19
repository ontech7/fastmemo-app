import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { Storage } from "redux-persist";

import type { Note, NotesState } from "@/types";

/**
 * Notes used to be persisted twice: in their own storage (`persist:root_notes`: a file on native,
 * IndexedDB on web) and again inside the outer `persist:root` AsyncStorage blob, next to the other
 * slices. On boot, whichever copy finished rehydrating last replaced the other, and every edit also
 * rewrote all notes into that blob (seconds per write with many notes, and past 2MB Android can't
 * even read it back). See LL-003 and LL-022.
 *
 * The outer blob no longer holds notes. Before the first rehydrate without them, its copy is folded
 * into the notes storage, so nothing only that copy had is lost, and then dropped from the blob:
 * - the copy is first saved as-is under BACKUP_KEY, for recovery;
 * - stored notes stay authoritative; the copy only adds the notes they lack and newer versions
 *   (`updatedAt`) of notes in the same list. Its cloud outbox is ignored: replaying stale uploads or
 *   deletions isn't safe;
 * - every step is idempotent, so an interrupted run just repeats on the next boot.
 */

const ROOT_KEY = "persist:root";
const NOTES_KEY = "persist:root_notes";
const BACKUP_KEY = "backup:root-notes";
const DONE_KEY = "fastmemo:root-notes-folded";

type PersistedNotes = NotesState & { _persist?: unknown };

/** redux-persist's own layout: every top-level key holds its value as JSON. */
const serialize = (state: PersistedNotes) =>
  JSON.stringify(Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value)])));

const deserialize = (raw: string) =>
  Object.fromEntries(
    Object.entries(JSON.parse(raw) as Record<string, string>).map(([key, value]) => [key, JSON.parse(value)])
  ) as PersistedNotes;

const mergeList = (stored: Note[] | undefined, legacy: Note[] | undefined, storedIds: Set<string>) => {
  const legacyById = new Map((legacy ?? []).map((note) => [note.id, note]));
  const merged = (stored ?? []).map((note) => {
    const legacyNote = legacyById.get(note.id);
    return legacyNote && legacyNote.updatedAt > note.updatedAt ? legacyNote : note;
  });
  const added = (legacy ?? []).filter((note) => !storedIds.has(note.id));
  return { merged: [...merged, ...added], added: added.length };
};

const mergeNotes = (stored: PersistedNotes | undefined, legacy: PersistedNotes) => {
  if (!stored) {
    return { notes: legacy, added: (legacy.items?.length ?? 0) + (legacy.temporaryItems?.length ?? 0) };
  }

  const storedIds = new Set([...(stored.items ?? []), ...(stored.temporaryItems ?? [])].map((note) => note.id));
  const items = mergeList(stored.items, legacy.items, storedIds);
  const temporaryItems = mergeList(stored.temporaryItems, legacy.temporaryItems, storedIds);

  return {
    notes: { ...stored, items: items.merged, temporaryItems: temporaryItems.merged },
    added: items.added + temporaryItems.added,
  };
};

/**
 * Folds the legacy copy of the notes out of `persist:root` (see above). Resolves to the number of
 * notes it added, or `null` if it couldn't finish: notes must then keep being persisted in the
 * outer blob too for this session, so that copy isn't dropped.
 */
export async function foldLegacyRootNotes(notesStorage: Storage): Promise<number | null> {
  try {
    if (await notesStorage.getItem(DONE_KEY)) return 0;
  } catch {
    // Look at the blob anyway: folding twice is harmless.
  }

  let root: Record<string, string> | null = null;
  try {
    root = JSON.parse((await AsyncStorage.getItem(ROOT_KEY)) ?? "null");
  } catch {
    // Unreadable (e.g. a row over Android's 2MB cursor window) or corrupt: rehydrate couldn't read
    // it either, so that copy was never what the user saw.
  }

  try {
    let added = 0;

    if (root && typeof root.notes === "string") {
      await notesStorage.setItem(BACKUP_KEY, root.notes);

      const storedRaw: string | null | undefined = await notesStorage.getItem(NOTES_KEY);
      const result = mergeNotes(storedRaw ? deserialize(storedRaw) : undefined, JSON.parse(root.notes));
      await notesStorage.setItem(NOTES_KEY, serialize(result.notes));
      added = result.added;

      const { notes: _legacyNotes, ...rest } = root;
      await AsyncStorage.setItem(ROOT_KEY, JSON.stringify(rest));
    }

    await notesStorage.setItem(DONE_KEY, "1");
    return added;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
