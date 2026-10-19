import type { Category, Note } from "@/types";

import { noteRev } from "./revision";

/*
 * How incoming versions merge with this device's notes (ADR-016). Pure: the engine feeds a planner and dispatches the plan.
 *
 * - An incoming version older than this device's is a stale replay: ignored.
 * - A newer one replaces the note, unless both sides changed it since the last sync: then both are kept, the newer under the
 *   note's id and the other as a conflict copy (`<id>~<its revision>`, so every device makes the same copy, once).
 * - A deletion applies only when it's newer than the note; an edit newer than a deletion brings the note back.
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
   * revision alone settles (a stale replay, a version this device already has) is handled here.
   */
  offer(id: string, rev: number): boolean;
  /** An incoming version (decrypted). */
  add(remote: Note): void;
  /** An incoming deletion stub. */
  remove(stub: Note): void;
  /** An incoming detach stub: another device made the note device-only. */
  detach(stub: Note): void;
  /**
   * Full sync: `cloud` holds every note the cloud has that this device could decrypt, `cloudRevs` the revision of every
   * note it has. Merges them, then makes sure the cloud gets what only this device has: nothing is ever dropped for being
   * absent from the cloud (that can't tell "deleted elsewhere" from "the cloud was reset").
   */
  reconcile(cloud: Note[], cloudRevs: Record<string, number>): void;
  plan(): SyncPlan;
}

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

  /** Unsynced local changes. Unknown bookkeeping (synced before revisions existed): a waiting upload. */
  const isDirty = (note: Note) => (note.syncedRev === undefined ? isPendingUpload(note.id) : noteRev(note) > note.syncedRev);

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

  const offer = (id: string, rev: number): boolean => {
    const mine = live.get(id);
    if (mine) {
      if (mine.local) return false;
      const mineRev = noteRev(mine);
      if (rev === mineRev) {
        if (mine.syncedRev === undefined || mine.syncedRev < rev) markSynced(id, rev);
        return false;
      }
      if (rev > mineRev) return true;
      // Older: only a version made concurrently with this device's unsynced changes matters (it's kept as a copy).
      return isDirty(mine) && mine.syncedRev !== undefined && rev > mine.syncedRev;
    }
    const bin = trashed.get(id);
    if (bin) return rev > noteRev(bin);
    const purgedRev = local.purged[id];
    return purgedRev === undefined || rev > purgedRev;
  };

  const add = (remote: Note) => {
    const id = remote.id;
    const rev = noteRev(remote);
    if (!offer(id, rev)) return;

    const mine = live.get(id);
    if (mine) {
      if (rev < noteRev(mine)) {
        // Both changed since the last sync, this device's change is the newer.
        keepCopy(remote);
        markSynced(id, rev);
        return;
      }
      if (isDirty(mine)) keepCopy(mine);
      putLive(asSynced(remote));
      dropUploads.add(id);
      return;
    }

    if (trashed.has(id)) dropDeletes.add(id);
    putLive(asSynced(remote));
  };

  const remove = (stub: Note) => {
    const mine = live.get(stub.id);
    if (!mine || mine.local) return;

    const rev = noteRev(stub);
    // Changed after the deletion: it stays (and its upload, if still waiting, puts it back in the cloud).
    if (rev < noteRev(mine)) return;

    const { syncedRev: _syncedRev, ...note } = mine;
    live.delete(note.id);
    trashed.set(note.id, { ...note, rev, deletedAt: stub.deletedAt ?? rev, syncedRev: rev } as Note);
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

  const reconcile = (cloud: Note[], cloudRevs: Record<string, number>) => {
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

    live.forEach((mine, id) => {
      if (!mine.local && !(id in cloudRevs) && !isPendingUpload(id)) upload.add(id);
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
