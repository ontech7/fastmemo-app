import type { Note } from "@/types";
import { getReversedDateTime } from "@/utils/dateParse";

/*
 * Note revisions (ADR-016). Pure helpers, shared by the slice, the merge and the backends.
 */

type Versioned = Pick<Note, "rev" | "updatedAt">;

/** A note's revision: `rev`, or `updatedAt` for a version an older app wrote (those only bump that). */
export const noteRev = (note: Versioned): number => Math.max(Number(note.rev) || 0, Number(note.updatedAt) || 0);

/**
 * The revision for a new change: now, but always above the note's current one, so an edit made on a device whose clock is
 * behind still supersedes what it was based on.
 */
export const nextRev = (note: Versioned | undefined, now: number = Date.now()): number =>
  note ? Math.max(now, noteRev(note) + 1) : now;

/**
 * The cloud revision a change to this note builds on: `syncedRev`, or for a note last written by an older app version
 * (no revision yet) the version it has, which is the last one it synced or its own change still waiting to go out.
 */
export const baseOf = (note: Note): number | undefined =>
  note.syncedRev ?? (note.rev === undefined && !note.local ? noteRev(note) : undefined);

/**
 * The notes as an app version without revisions stored them, taken over on this version's first launch. Those versions
 * never stamp a revision: a note with one got it from the cloud (a newer version wrote it), so that's the revision it last
 * synced. Without it, every later version from the cloud would find a change here and keep this one as a conflict copy.
 * A note with an upload waiting stays as it is: that's a change (see `isDirty` in the merge).
 */
export const adoptLegacySyncState = <T extends { items?: Note[]; cloud?: { items?: { add?: Record<string, unknown> } } }>(
  state: T
): T => {
  if (!Array.isArray(state.items)) return state;
  const pending = state.cloud?.items?.add ?? {};
  let adopted = 0;
  const items = state.items.map((note) => {
    if (note.rev === undefined || note.syncedRev !== undefined || note.local || note.id in pending) return note;
    adopted++;
    return { ...note, syncedRev: Number(note.rev) || 0 };
  });
  return adopted > 0 ? { ...state, items } : state;
};

/** Stamps a synced change on a note (a draft, inside a reducer). */
export const touchNote = (note: Note, now: number = Date.now()): void => {
  const base = baseOf(note);
  if (base !== undefined) note.syncedRev = base;
  note.rev = nextRev(note, now);
};

/**
 * The note as it's uploaded: without this device's bookkeeping, and with a `createdAt` (older app versions list the cloud's
 * notes ordered by it, which leaves out a note without one; they filled it in the same way).
 */
export const forUpload = (note: Note): Note => {
  const { syncedRev: _syncedRev, ...rest } = note;
  return { ...rest, createdAt: rest.createdAt ?? createdAtOf(rest as Note) } as Note;
};

const createdAtOf = (note: Note): number => {
  try {
    return getReversedDateTime(note.date) || note.updatedAt;
  } catch {
    return note.updatedAt; // no parsable date
  }
};

/**
 * What a deletion or detach sends: the id and the revision, no content (it needs no key and leaks nothing). Older app
 * versions only read the id.
 */
export const deletionStub = (note: Note): Note =>
  ({
    id: note.id,
    type: note.type,
    rev: noteRev(note),
    updatedAt: note.updatedAt,
    ...(note.deletedAt !== undefined ? { deletedAt: note.deletedAt } : {}),
  }) as Note;

/** How long a permanently deleted note's id keeps blocking older copies. */
export const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/** Drops the tombstones past their TTL (a draft, inside a reducer). */
export const pruneTombstones = (purged: Record<string, number>, now: number = Date.now()): void => {
  Object.entries(purged).forEach(([id, rev]) => {
    if (now - rev > TOMBSTONE_TTL_MS) delete purged[id];
  });
};
