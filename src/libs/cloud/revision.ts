import type { Note } from "@/types";

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

/** Stamps a synced change on a note (a draft, inside a reducer). */
export const touchNote = (note: Note, now: number = Date.now()): void => {
  note.rev = nextRev(note, now);
};

/** The note as it's uploaded: without this device's bookkeeping. */
export const forUpload = (note: Note): Note => {
  const { syncedRev: _syncedRev, ...rest } = note;
  return rest as Note;
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
