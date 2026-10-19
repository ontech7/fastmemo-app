import type { Category, Note } from "@/types";

import { noteRev } from "./revision";
import { contentToken } from "./token";
import type { Tombstone } from "./types";

/*
 * How incoming versions merge with this device's notes (ADR-016). Pure: the engine feeds a planner and dispatches the plan.
 *
 * - An incoming version older than this device's is a stale replay: ignored.
 * - A newer one replaces the note, unless both sides changed it since the last sync: then both are kept, the newer under the
 *   note's id and the other as a conflict copy (`<id>~<its revision>`, so every device makes the same copy, once).
 * - A deletion applies only when it's newer than the note; an edit newer than a deletion brings the note back.
 * - The same revision with different content is a change too: older app versions change some fields (flags, category,
 *   a restore) without a new revision. The incoming version is the cloud's, so it keeps the note.
 */

export interface LocalNotes {
  items: Note[];
  trash: Note[];
  purged: Record<string, number>;
  /** The outbox: ids with an upload / a deletion waiting. */
  pendingUploads: Record<string, unknown>;
  pendingDeletes: Record<string, unknown>;
}

export interface SyncPlan {
  /** Live notes to store (new, or replacing the note with that id, live or trashed). */
  put: Note[];
  /** Live notes to move to the trash, as they'll be stored there (the reducer sets `deleteDate`). */
  trash: Note[];
  /** Ids to make device-only. */
  detach: string[];
  /** Revisions now known to be in the cloud, for notes otherwise left as they are. */
  synced: Record<string, number>;
  /** Outbox entries made obsolete. */
  dropUploads: string[];
  dropDeletes: string[];
  /** Live notes to (re)upload, and trashed notes whose deletion to (re)send. */
  upload: string[];
  sendDeletes: string[];
  /** Deletions to send for notes no longer stored here (permanently deleted). */
  sendStubs: Note[];
  /** Conflict copies created. */
  conflicts: string[];
  /** Ids whose stored note changed: an open editor reloads it. */
  changed: string[];
}

export const isEmptyPlan = (plan: SyncPlan): boolean =>
  plan.put.length === 0 &&
  plan.trash.length === 0 &&
  plan.detach.length === 0 &&
  Object.keys(plan.synced).length === 0 &&
  plan.dropUploads.length === 0 &&
  plan.dropDeletes.length === 0 &&
  plan.upload.length === 0 &&
  plan.sendDeletes.length === 0 &&
  plan.sendStubs.length === 0;

export interface Planner {
  /**
   * Whether the version `rev` of note `id` needs its content to be merged (decrypt or fetch it, then `add` it). What the
   * revision alone settles (a stale replay) is handled here. `hasContent`: false for a reference, whose content would have
   * to be fetched; one with the revision this device has is taken as that version (only newer apps queue references).
   */
  offer(id: string, rev: number, hasContent?: boolean): boolean;
  /** An incoming version (decrypted). */
  add(remote: Note): void;
  /** An incoming deletion stub. */
  remove(stub: Note): void;
  /** An incoming detach stub: another device made the note device-only. */
  detach(stub: Note): void;
  /**
   * Full sync: `cloud` holds every note the cloud has that this device could decrypt, `cloudRevs` the revision of every
   * note it has, `tombstones` the deletions recorded there. Merges them, then makes sure the cloud gets what only this
   * device has: a note absent from the cloud is uploaded again, unless a tombstone says it was deleted (or made
   * device-only) after this version (absence alone can't tell "deleted elsewhere" from "the cloud was reset").
   */
  reconcile(cloud: Note[], cloudRevs: Record<string, number>, tombstones: Record<string, Tombstone>): void;
  plan(): SyncPlan;
}

/** What a version is, without this device's bookkeeping (nor `createdAt`, which an upload fills in when missing). */
const versionOf = (note: Note): Record<string, unknown> => {
  const version: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(note)) {
    if (value === undefined || value === null || BOOKKEEPING.has(key)) continue;
    if (key === "category" && typeof value === "object") {
      // `selected` is a device's UI state.
      const { selected: _selected, ...category } = value as Category;
      version[key] = category;
    } else {
      version[key] = value;
    }
  }
  return version;
};

const BOOKKEEPING = new Set(["syncedRev", "local", "rev", "deletedAt", "deleteDate", "createdAt"]);

/** Whether two notes with the same revision are the same version. */
const sameVersion = (a: Note, b: Note): boolean => contentToken(versionOf(a)) === contentToken(versionOf(b));

export const createPlanner = (local: LocalNotes, conflictSuffix: string): Planner => {
  const live = new Map(local.items.map((note) => [note.id, note]));
  const trashed = new Map(local.trash.map((note) => [note.id, note]));

  const put = new Set<string>();
  const binned = new Set<string>();
  const detached = new Set<string>();
  const synced: Record<string, number> = {};
  const dropUploads = new Set<string>();
  const dropDeletes = new Set<string>();
  const upload = new Set<string>();
  const sendDeletes = new Set<string>();
  const sendStubs = new Map<string, Note>();
  const conflicts: string[] = [];

  const isPendingUpload = (id: string) => id in local.pendingUploads && !dropUploads.has(id);
  const isPendingDelete = (id: string) => id in local.pendingDeletes && !dropDeletes.has(id);

  /**
   * Unsynced local changes. No `syncedRev`: stamped here but never synced (it has a revision), or last written by an older
   * app version, where only a waiting upload is a change.
   */
  const isDirty = (note: Note) =>
    note.syncedRev === undefined ? note.rev !== undefined || isPendingUpload(note.id) : noteRev(note) > note.syncedRev;

  const markSynced = (id: string, rev: number) => {
    synced[id] = Math.max(synced[id] ?? 0, rev);
  };

  const putLive = (note: Note) => {
    live.set(note.id, note);
    trashed.delete(note.id);
    put.add(note.id);
    binned.delete(note.id);
  };

  const asSynced = (remote: Note): Note => ({ ...remote, syncedRev: noteRev(remote) });

  /** Keeps a version that lost to a concurrent one, as a new note. */
  const keepCopy = (loser: Note) => {
    const rev = noteRev(loser);
    const id = `${loser.id}~${rev}`;
    // Made already (here, or by another device that hit the same conflict), or deleted since.
    if (live.has(id) || trashed.has(id) || local.purged[id] !== undefined) return;

    const { syncedRev: _syncedRev, deletedAt: _deletedAt, ...version } = loser;
    putLive({
      ...version,
      id,
      title: `${loser.title ?? ""} ${conflictSuffix}`.trim(),
      rev,
      local: false,
      deleteDate: null,
    } as Note);
    upload.add(id);
    conflicts.push(id);
  };

  const offer = (id: string, rev: number, hasContent = true): boolean => {
    const mine = live.get(id);
    if (mine) {
      if (mine.local) return false;
      const mineRev = noteRev(mine);
      if (rev === mineRev) {
        // Almost always the version this device has, but only the content tells (see the header).
        if (hasContent) return true;
        if (mine.syncedRev === undefined || mine.syncedRev < rev) markSynced(id, rev);
        return false;
      }
      if (rev > mineRev) return true;
      // Older: only a version made concurrently with this device's unsynced changes matters (it's kept as a copy).
      return isDirty(mine) && mine.syncedRev !== undefined && rev > mine.syncedRev;
    }
    const bin = trashed.get(id);
    // The same revision as a deletion an older app version sent (it stamps none): its restore, when in doubt (LL-023).
    if (bin) return rev > noteRev(bin) || (rev === noteRev(bin) && bin.deletedAt === undefined);
    const purgedRev = local.purged[id];
    return purgedRev === undefined || rev > purgedRev;
  };

  const add = (remote: Note) => {
    const id = remote.id;
    const rev = noteRev(remote);
    if (!offer(id, rev)) return;

    const mine = live.get(id);
    if (mine) {
      const mineRev = noteRev(mine);
      if (rev === mineRev && sameVersion(remote, mine)) {
        if (mine.syncedRev === undefined || mine.syncedRev < rev) markSynced(id, rev);
        // A waiting upload of it already went through (e.g. its push's reply was lost).
        if (isPendingUpload(id)) dropUploads.add(id);
        return;
      }
      if (rev < mineRev) {
        // Both changed since the last sync, this device's change is the newer.
        keepCopy(remote);
        markSynced(id, rev);
        return;
      }
      // Newer, or the same revision with other content (the cloud's: it wins).
      if (isDirty(mine)) keepCopy(mine);
      putLive(asSynced(remote));
      dropUploads.add(id);
      return;
    }

    // Back from the trash, or from a permanent deletion: a deletion still waiting to go out is outdated.
    if (isPendingDelete(id)) dropDeletes.add(id);
    putLive(asSynced(remote));
  };

  const remove = (stub: Note) => {
    const mine = live.get(stub.id);
    if (!mine || mine.local) return;

    const rev = noteRev(stub);
    // Changed after the deletion: it stays (and its upload, if still waiting, puts it back in the cloud).
    if (rev < noteRev(mine)) return;

    const { syncedRev: _syncedRev, deletedAt: _deletedAt, ...note } = mine;
    live.delete(note.id);
    // No `deletedAt`: an older app version's deletion (see offer).
    trashed.set(note.id, {
      ...note,
      rev,
      ...(stub.deletedAt !== undefined && { deletedAt: stub.deletedAt }),
      syncedRev: rev,
    } as Note);
    binned.add(note.id);
    put.delete(note.id);
    dropUploads.add(note.id);
  };

  const detach = (stub: Note) => {
    const mine = live.get(stub.id);
    if (!mine || mine.local) return;
    live.set(mine.id, { ...mine, local: true });
    detached.add(mine.id);
    dropUploads.add(mine.id);
  };

  const reconcile = (cloud: Note[], cloudRevs: Record<string, number>, tombstones: Record<string, Tombstone>) => {
    cloud.forEach(add);

    Object.entries(cloudRevs).forEach(([id, cloudRev]) => {
      const mine = live.get(id);
      if (mine) {
        if (!mine.local && noteRev(mine) > cloudRev && !isPendingUpload(id)) upload.add(id);
        return;
      }
      const bin = trashed.get(id);
      if (bin) {
        if (noteRev(bin) >= cloudRev && !isPendingDelete(id)) sendDeletes.add(id);
        return;
      }
      const purgedRev = local.purged[id];
      if (purgedRev !== undefined && purgedRev >= cloudRev) {
        sendStubs.set(id, { id, rev: purgedRev, updatedAt: purgedRev, deletedAt: purgedRev } as Note);
      }
    });

    [...live].forEach(([id, mine]) => {
      if (mine.local || id in cloudRevs) return;
      const tombstone = tombstones[id];
      if (tombstone && tombstone.rev >= noteRev(mine)) {
        // Deleted, or made device-only, elsewhere after this version: why the cloud doesn't have it.
        const stub = { id, type: mine.type, rev: tombstone.rev, updatedAt: tombstone.rev, deletedAt: tombstone.rev } as Note;
        if (tombstone.detach) detach(stub);
        else remove(stub);
        return;
      }
      if (!isPendingUpload(id)) upload.add(id);
    });
  };

  const plan = (): SyncPlan => ({
    put: [...put].map((id) => live.get(id)!),
    trash: [...binned].map((id) => trashed.get(id)!),
    detach: [...detached].filter((id) => !binned.has(id)),
    synced,
    dropUploads: [...dropUploads],
    dropDeletes: [...dropDeletes],
    upload: [...upload].filter((id) => live.has(id) && !live.get(id)!.local),
    sendDeletes: [...sendDeletes].filter((id) => trashed.has(id)),
    sendStubs: [...sendStubs.values()],
    conflicts,
    changed: [...new Set([...put, ...binned, ...detached])],
  });

  return { offer, add, remove, detach, reconcile, plan };
};

/*
 * Categories: last writer wins, as before (they carry no revision). `selected` is this device's UI state: never taken from
 * the cloud nor sent to it.
 */

export interface CategoryPlan {
  items: Category[];
  /** Icons to (re)upload. */
  upload: string[];
}

/** Full sync of the categories: the cloud's version wins unless this device has a change waiting, nothing is dropped. */
export const reconcileCategories = (
  local: Category[],
  pending: { add: Record<string, unknown>; delete: Record<string, unknown> },
  cloud: Category[]
): CategoryPlan => {
  const byIcon = new Map(local.map((category) => [category.icon, category]));
  const cloudIcons = new Set<string>();

  cloud.forEach((remote) => {
    if (remote.index) return;
    cloudIcons.add(remote.icon);
    if (remote.icon in pending.add || remote.icon in pending.delete) return;
    const mine = byIcon.get(remote.icon);
    byIcon.set(remote.icon, { ...remote, selected: mine?.selected ?? false });
  });

  const upload = local
    .filter((category) => !category.index && !cloudIcons.has(category.icon) && !(category.icon in pending.add))
    .map((category) => category.icon);

  const items = [...byIcon.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { items, upload };
};
