import type { UnknownAction } from "@reduxjs/toolkit";

import type { Category, Note, RootState } from "@/types";
import type { VaultDoc } from "@/utils/vault";

import { createPlanner, isEmptyPlan, reconcileCategories, type LocalNotes, type SyncPlan } from "./merge";
import { deletionStub, forUpload, noteRev } from "./revision";
import type { ChangeSet, CloudBackend, CloudDevice, DevicesSnapshot, NoteRef, PushOps } from "./types";

/*
 * The sync engine (ADR-016): listens to the device docs and the vault, merges what other devices queued for this one,
 * pushes this device's outbox, and acknowledges. Every step runs one at a time, in order, so a merge never interleaves with
 * a push: incoming changes are always merged before this device pushes over them.
 */

/** Wait after an outbox change, so a burst of changes goes out as one push. */
const PUSH_DEBOUNCE_MS = 200;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 5 * 60 * 1000;
/** Server read of the device docs and vault: covers a listener that died without telling. */
const POLL_MS = 5 * 60 * 1000;
/** Presence is rewritten this often while a note stays open (others drop it after PRESENCE_TTL_MS). */
const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;
const PRESENCE_DEBOUNCE_MS = 1000;

export interface SyncStore {
  getState(): RootState;
  dispatch(action: UnknownAction): unknown;
  subscribe(listener: () => void): () => void;
}

/** The slice actions the engine dispatches (passed in, so the engine can run against a test store). */
export interface SyncActions {
  applyNotesPlan(plan: SyncPlan): UnknownAction;
  notesPushed(pushed: NotesPushed): UnknownAction;
  dropNoteUploads(ids: string[]): UnknownAction;
  applyCategoriesPlan(plan: { items: Category[]; upload: string[] }): UnknownAction;
  categoriesPushed(pushed: CategoriesPushed): UnknownAction;
  addLocalCategories(categories: Record<string, Category>): UnknownAction;
  deleteLocalCategories(categories: Record<string, Category>): UnknownAction;
}

/** An outbox entry that went out: dequeued only if still the same entry (a newer change replaced it otherwise). */
export interface PushedEntry<T> {
  id: string;
  entry: T;
  /** The revision that went out. */
  rev: number;
}

export interface NotesPushed {
  add: PushedEntry<Note>[];
  delete: PushedEntry<Note>[];
  detach: PushedEntry<Note>[];
}

export interface CategoriesPushed {
  add: PushedEntry<Category>[];
  delete: PushedEntry<Category>[];
}

export interface SyncCrypto {
  /** Throws without a key. */
  encrypt(note: Note): Note;
  /** Null when the note can't be read with this device's key. */
  decrypt(note: Note): Note | null;
  /** Whether this device's key opens the vault. */
  matches(vault: VaultDoc): boolean;
}

export interface SyncEvents {
  /** Incoming changes were merged. `changed`: note ids whose stored note changed; `conflicts`: copies made. */
  onApplied(result: { changed: string[]; conflicts: string[]; categories: boolean; full: boolean }): void;
  /** The device list changed (presence, recipients, pending counts). */
  onDevices(devices: CloudDevice[]): void;
  /** This device was removed from the cloud. The engine stopped. */
  onRemoved(): void;
  /** The vault was reset or replaced on another device: this device's key is stale. The engine stopped. */
  onVaultStale(): void;
}

export interface SyncEngineOptions {
  backend: CloudBackend;
  me: string;
  store: SyncStore;
  actions: SyncActions;
  crypto: SyncCrypto;
  /** Writes the persisted state now: applied changes are on disk before they're acknowledged. */
  persist(): Promise<void>;
  /** Commits the open editors' pending edits, so a merge sees them. */
  flushEditors(): void;
  /** Appended to the title of a conflict copy. */
  conflictSuffix(): string;
  events: SyncEvents;
}

const isRef = (entry: Note | NoteRef): entry is NoteRef => (entry as NoteRef).ref === true;

const localNotes = (state: RootState): LocalNotes => ({
  items: state.notes.items,
  trash: state.notes.temporaryItems,
  purged: state.notes.purged ?? {},
  pendingUploads: state.notes.cloud.items.add,
  pendingDeletes: state.notes.cloud.items.delete,
});

const hasOutbox = (state: RootState, skip: Set<string>): boolean => {
  const notes = state.notes.cloud.items;
  const categories = state.categories.cloud.items;
  return [notes.add, notes.delete, notes.detach ?? {}, categories.add, categories.delete].some((queue) =>
    Object.keys(queue).some((key) => !skip.has(key))
  );
};

export class SyncEngine {
  private readonly o: SyncEngineOptions;

  private running = false;
  private tail: Promise<unknown> = Promise.resolve();

  private devices: CloudDevice[] = [];
  /** The latest server snapshot not processed yet. */
  private pendingSnapshot: DevicesSnapshot | null = null;
  /** A server snapshot was merged since start: pushes may go out. */
  private devicesReady = false;
  /** The vault was read from the server and opens with this device's key. */
  private vaultOk = false;
  /** Change sets merged but not acknowledged yet (sender -> token): a retry only acknowledges. */
  private readonly merged = new Map<string, string>();
  /** Outbox keys the backend refused for good: not retried until the next launch. */
  private readonly rejected = new Set<string>();

  /** The store subscription and the cloud listeners. */
  private unsubscribers: (() => void)[] = [];
  private listeners: (() => void)[] = [];
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private resubscribeDelay = 0;

  private presence: string | null = null;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private lastOutbox: unknown[] = [];

  constructor(options: SyncEngineOptions) {
    this.o = options;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Starts listening and pushing. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.devicesReady = false;
    this.vaultOk = false;
    this.subscribe();
    this.pollTimer = setInterval(() => this.pull(), POLL_MS);

    this.lastOutbox = this.outboxRefs();
    this.unsubscribers.push(
      this.o.store.subscribe(() => {
        const refs = this.outboxRefs();
        if (refs.some((ref, i) => ref !== this.lastOutbox[i])) {
          this.lastOutbox = refs;
          this.kick();
        }
      })
    );
    if (this.presence) this.sendPresence();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.unsubscribeListeners();
    [this.pushTimer, this.retryTimer, this.resubscribeTimer, this.presenceTimer].forEach((t) => t && clearTimeout(t));
    [this.pollTimer, this.heartbeatTimer].forEach((t) => t && clearInterval(t));
    this.pushTimer = this.retryTimer = this.resubscribeTimer = this.presenceTimer = null;
    this.pollTimer = this.heartbeatTimer = null;
    this.retryDelay = 0;
    this.pendingSnapshot = null;
    this.merged.clear();
  }

  /** The outbox changed: push soon. */
  kick(delay: number = PUSH_DEBOUNCE_MS): void {
    if (!this.running) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.serial(() => this.pushPass());
    }, delay);
  }

  /** Back in the foreground or online: revive a transport a sleep may have wedged, then pull and push. */
  async resume(): Promise<void> {
    if (!this.running) return;
    await this.o.backend.reconnect();
    this.pull();
    this.kick(0);
  }

  /**
   * Full sync (connect, unlock, "sync now", a sender's overflowed queue): merges what's queued for this device, then the
   * whole cloud, then pushes. Runs whether or not the engine is started. False if it couldn't complete (e.g. offline).
   */
  fullSync(onProgress?: (done: number, total: number) => void): Promise<boolean> {
    return this.serial(async () => {
      const snapshot = await this.o.backend.pullDevices(this.o.me);
      if (!snapshot) return false;
      this.pendingSnapshot = snapshot;
      if (!(await this.processDevices())) return false;
      if (!(await this.reconcile(true))) return false;
      const pushed = await this.pushOutbox(onProgress);
      if (pushed === "nothing") await this.o.backend.touchLastSync(this.o.me);
      return pushed !== "retry";
    }, true);
  }

  /** The note open in an editor here (null: none), shown to the other devices. */
  setPresence(noteId: string | null): void {
    if (this.presence === noteId) return;
    this.presence = noteId;
    if (this.running) this.sendPresence();
  }

  /** An editor closed: clears the presence, unless another note was opened since (screens overlap while navigating). */
  releasePresence(noteId: string): void {
    if (this.presence === noteId) this.setPresence(null);
  }

  // --- Internals ---

  /** Runs tasks one at a time. `force`: also when the engine isn't started (full sync). */
  private serial<T>(task: () => Promise<T>, force = false): Promise<T> {
    const run = this.tail.then(() => (this.running || force ? task() : (undefined as T)));
    this.tail = run.catch((e) => console.log("sync:", e));
    return run;
  }

  private outboxRefs(): unknown[] {
    const { notes, categories } = this.o.store.getState();
    return [
      notes.cloud.items.add,
      notes.cloud.items.delete,
      notes.cloud.items.detach,
      categories.cloud.items.add,
      categories.cloud.items.delete,
    ];
  }

  private subscribe(): void {
    const { backend, me } = this.o;
    const onError = (error: unknown) => {
      console.log("sync listener:", error);
      this.unsubscribeListeners();
      // Firestore doesn't restart a listener that errored: subscribe again, pulling meanwhile.
      this.resubscribeDelay = Math.min(Math.max(this.resubscribeDelay * 2, RETRY_MIN_MS), RETRY_MAX_MS);
      this.resubscribeTimer = setTimeout(() => {
        this.resubscribeTimer = null;
        if (this.running) this.subscribe();
      }, this.resubscribeDelay);
      this.pull();
    };

    const devices = backend.subscribeDevices(
      me,
      (snapshot) => {
        if (!snapshot.fromServer) return;
        this.resubscribeDelay = 0;
        this.pendingSnapshot = snapshot;
        this.serial(() => this.processDevices());
      },
      onError
    );
    const vault = backend.subscribeVault((read) => {
      if (read.status === "error") return;
      if (read.status === "absent" || !this.o.crypto.matches(read.vault)) {
        this.vaultStale();
        return;
      }
      if (!this.vaultOk) {
        this.vaultOk = true;
        this.kick(0);
      }
    });
    this.listeners.push(devices, vault);
  }

  private unsubscribeListeners(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners = [];
  }

  /** Server read of the device docs (and the vault), merged like a snapshot. */
  private pull(): void {
    this.serial(async () => {
      if (!(await this.checkVault())) return;
      const snapshot = await this.o.backend.pullDevices(this.o.me);
      if (!snapshot) return;
      this.pendingSnapshot = snapshot;
      await this.processDevices();
    });
  }

  private vaultStale(): void {
    this.vaultOk = false;
    this.stop();
    this.o.events.onVaultStale();
  }

  /** Server read of the vault: true if this device's key opens it. */
  private async checkVault(): Promise<boolean> {
    const read = await this.o.backend.readVault();
    if (read.status === "error") return false;
    if (read.status === "absent" || !this.o.crypto.matches(read.vault)) {
      this.vaultStale();
      return false;
    }
    this.vaultOk = true;
    return true;
  }

  /** Merges and acknowledges what the latest snapshot queued for this device. False: something to retry. */
  private async processDevices(): Promise<boolean> {
    const snapshot = this.pendingSnapshot;
    this.pendingSnapshot = null;
    if (!snapshot) return true;

    this.devices = snapshot.devices;
    this.o.events.onDevices(snapshot.devices);

    if (!snapshot.devices.some((device) => device.uuid === this.o.me)) {
      this.stop();
      this.o.events.onRemoved();
      return false;
    }

    if (!this.vaultOk && !(await this.checkVault())) return false;

    let complete = true;
    for (const change of snapshot.incoming) {
      if (!(await this.processChange(change))) complete = false;
    }
    this.devicesReady = true;

    if (complete) this.kick();
    else this.retry();
    return complete;
  }

  private async processChange(change: ChangeSet): Promise<boolean> {
    if (this.merged.get(change.source) !== change.token) {
      // A sender whose queue ran out of room left the rest to a full sync (deletions are always queued, see push).
      const ok = (await this.mergeChange(change)) && (!change.resync || (await this.reconcile(false)));
      if (!ok) return false;
      this.merged.set(change.source, change.token);
    }

    // "changed": the sender queued more meanwhile, its next snapshot brings it.
    const ack = await this.o.backend.ackChanges(this.o.me, change);
    if (ack === "error") return false;
    this.merged.delete(change.source);
    return true;
  }

  /**
   * Reads the incoming versions a merge needs (fetching the referenced ones, decrypting). Null when one couldn't be read
   * now: a failed fetch, or this device's key gone stale.
   */
  private async readVersions(entries: (Note | NoteRef)[]): Promise<Map<string, Note> | null> {
    const planner = createPlanner(localNotes(this.o.store.getState()), "");
    const versions = new Map<string, Note>();
    let unreadable = 0;

    for (const entry of entries) {
      if (!planner.offer(entry.id, noteRev(entry as Note))) continue;
      let note: Note | null | undefined = entry as Note;
      if (isRef(entry)) {
        // Queued as a reference (the sender's queue was full): fetch it.
        note = await this.o.backend.fetchNote(entry.id);
        if (note === undefined) return null;
        if (note === null) continue;
      }
      const plain = this.o.crypto.decrypt(note);
      if (plain) versions.set(plain.id, plain);
      else unreadable++;
    }

    // Unreadable with this key: the vault may have been reset elsewhere. Otherwise it's a note this key never sealed
    // (garbage): skipped.
    if (unreadable > 0 && !(await this.checkVault())) return null;
    return versions;
  }

  private async mergeChange(change: ChangeSet): Promise<boolean> {
    const adds = Object.values(change.notes.add);
    const versions = await this.readVersions(adds);
    if (!versions) return false;

    const deletes = Object.values(change.notes.delete);
    const detaches = Object.values(change.notes.detach);
    const categoryAdds = change.categories.add;
    const categoryDeletes = change.categories.delete;

    // From here to the dispatch nothing awaits: the plan is made against the current state, edits included.
    this.o.flushEditors();
    const planner = createPlanner(localNotes(this.o.store.getState()), this.o.conflictSuffix());
    for (const entry of adds) {
      // Settles what the revision alone does (e.g. marks a version this device has as synced), then merges the rest.
      if (!planner.offer(entry.id, noteRev(entry as Note))) continue;
      const version = versions.get(entry.id);
      if (version) planner.add(version);
    }
    deletes.forEach(planner.remove);
    detaches.forEach(planner.detach);
    const plan = planner.plan();
    if (!isEmptyPlan(plan)) this.o.store.dispatch(this.o.actions.applyNotesPlan(plan));

    const categories = Object.keys(categoryAdds).length > 0 || Object.keys(categoryDeletes).length > 0;
    if (Object.keys(categoryAdds).length > 0) this.o.store.dispatch(this.o.actions.addLocalCategories(categoryAdds));
    if (Object.keys(categoryDeletes).length > 0) this.o.store.dispatch(this.o.actions.deleteLocalCategories(categoryDeletes));

    await this.o.persist();
    if (plan.changed.length > 0 || categories) {
      this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories, full: false });
    }
    return true;
  }

  /** Merges the whole cloud with this device's notes and categories. */
  private async reconcile(full: boolean): Promise<boolean> {
    const { backend, crypto, store } = this.o;
    const cloudNotes = await backend.fetchNotes();
    if (!cloudNotes) return false;
    const cloudCategories = await backend.fetchCategories();
    if (!cloudCategories) return false;

    const cloudRevs: Record<string, number> = {};
    const versions: Note[] = [];
    let unreadable = 0;
    for (const note of cloudNotes) {
      cloudRevs[note.id] = noteRev(note);
      const plain = crypto.decrypt(note);
      if (plain) versions.push(plain);
      else unreadable++;
    }
    if (unreadable > 0 && !(await this.checkVault())) return false;

    this.o.flushEditors();
    const state = store.getState();
    const planner = createPlanner(localNotes(state), this.o.conflictSuffix());
    planner.reconcile(versions, cloudRevs);
    const plan = planner.plan();
    if (!isEmptyPlan(plan)) store.dispatch(this.o.actions.applyNotesPlan(plan));

    const categoryPlan = reconcileCategories(state.categories.items, state.categories.cloud.items, cloudCategories);
    store.dispatch(this.o.actions.applyCategoriesPlan(categoryPlan));

    await this.o.persist();
    this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories: true, full });
    return true;
  }

  /** Merges the cloud versions a push was refused over (decrypted first). */
  private async mergeSuperseded(cloudVersions: Note[]): Promise<boolean> {
    const versions: Note[] = [];
    const unreadable: Note[] = [];
    for (const note of cloudVersions) {
      const plain = this.o.crypto.decrypt(note);
      if (plain) versions.push(plain);
      else unreadable.push(note);
    }
    if (unreadable.length > 0 && !(await this.checkVault())) return false;

    this.o.flushEditors();
    const planner = createPlanner(localNotes(this.o.store.getState()), this.o.conflictSuffix());
    versions.forEach(planner.add);
    const plan = planner.plan();
    // A version this key never sealed is garbage: the next push overwrites it.
    unreadable.forEach((note) => (plan.synced[note.id] = Math.max(plan.synced[note.id] ?? 0, noteRev(note))));
    if (!isEmptyPlan(plan)) this.o.store.dispatch(this.o.actions.applyNotesPlan(plan));
    await this.o.persist();
    if (plan.changed.length > 0) {
      this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories: false, full: false });
    }
    return true;
  }

  private retry(): void {
    if (!this.running || this.retryTimer) return;
    this.retryDelay = Math.min(Math.max(this.retryDelay * 2, RETRY_MIN_MS), RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.pull();
      this.kick(0);
    }, this.retryDelay);
  }

  private async pushPass(): Promise<void> {
    if (!this.devicesReady || !this.vaultOk) return;
    const result = await this.pushOutbox();
    if (result === "retry") {
      this.retry();
      return;
    }
    this.retryDelay = 0;
    // Changes made while pushing, or merged from a refused push.
    if (result === "pushed" && hasOutbox(this.o.store.getState(), this.rejected)) this.kick();
  }

  /** Sends the outbox once. "retry": something is still to send (offline, error, or a merge that needs another pass). */
  private async pushOutbox(onProgress?: (done: number, total: number) => void): Promise<"nothing" | "pushed" | "retry"> {
    const { store, actions, crypto, backend, me } = this.o;
    const state = store.getState();
    const outbox = state.notes.cloud.items;
    const categoryOutbox = state.categories.cloud.items;
    const live = new Map(state.notes.items.map((note) => [note.id, note]));

    const ops: PushOps = {
      notes: { add: [], delete: [], detach: [] },
      categories: { add: [], delete: [] },
      bases: {},
    };
    const sent = {
      notes: {
        add: new Map<string, PushedEntry<Note>>(),
        delete: new Map<string, PushedEntry<Note>>(),
        detach: new Map<string, PushedEntry<Note>>(),
      },
      categories: { add: new Map<string, PushedEntry<Category>>(), delete: new Map<string, PushedEntry<Category>>() },
    };
    const gone: string[] = [];

    for (const [id, entry] of Object.entries(outbox.add)) {
      if (this.rejected.has(id)) continue;
      const note = live.get(id);
      if (!note || note.local) {
        gone.push(id);
        continue;
      }
      // Encrypted now, from the stored note: always its latest content, under the current key.
      try {
        ops.notes.add.push(crypto.encrypt(forUpload(note)));
      } catch {
        return "retry"; // locked meanwhile
      }
      ops.bases[id] = note.syncedRev;
      sent.notes.add.set(id, { id, entry, rev: noteRev(note) });
    }
    for (const [id, entry] of Object.entries(outbox.delete)) {
      if (this.rejected.has(id)) continue;
      const stub = deletionStub(entry);
      ops.notes.delete.push(stub);
      sent.notes.delete.set(id, { id, entry, rev: noteRev(stub) });
    }
    for (const [id, entry] of Object.entries(outbox.detach ?? {})) {
      if (this.rejected.has(id)) continue;
      const stub = deletionStub(entry);
      ops.notes.detach.push(stub);
      sent.notes.detach.set(id, { id, entry, rev: noteRev(stub) });
    }
    for (const [icon, entry] of Object.entries(categoryOutbox.add)) {
      if (this.rejected.has(icon)) continue;
      ops.categories.add.push({ ...entry, index: entry.index ?? false, order: entry.order ?? 1 });
      sent.categories.add.set(icon, { id: icon, entry, rev: 0 });
    }
    for (const [icon, entry] of Object.entries(categoryOutbox.delete)) {
      if (this.rejected.has(icon)) continue;
      ops.categories.delete.push({ ...entry, index: entry.index ?? false, order: entry.order ?? 1 });
      sent.categories.delete.set(icon, { id: icon, entry, rev: 0 });
    }

    if (gone.length > 0) store.dispatch(actions.dropNoteUploads(gone));

    const total =
      ops.notes.add.length +
      ops.notes.delete.length +
      ops.notes.detach.length +
      ops.categories.add.length +
      ops.categories.delete.length;
    if (total === 0) return "nothing";

    const recipients = this.devices.filter((device) => device.uuid !== me).map((device) => device.uuid);
    const result = await backend.push(me, ops, recipients, onProgress);

    const pick = <T>(map: Map<string, PushedEntry<T>>, ids: string[]) =>
      ids.map((id) => map.get(id)).filter((entry): entry is PushedEntry<T> => entry !== undefined);
    const { committed } = result;
    store.dispatch(
      actions.notesPushed({
        add: pick(sent.notes.add, committed.notes.add),
        delete: pick(sent.notes.delete, committed.notes.delete),
        detach: pick(sent.notes.detach, committed.notes.detach),
      })
    );
    store.dispatch(
      actions.categoriesPushed({
        add: pick(sent.categories.add, committed.categories.add),
        delete: pick(sent.categories.delete, committed.categories.delete),
      })
    );
    result.rejected.forEach((key) => this.rejected.add(key));

    if (result.superseded.length > 0) {
      if (!(await this.mergeSuperseded(result.superseded))) return "retry";
      // Merged: the outbox entries now build on the cloud's version. Go again, unless nothing went through at all (then
      // back off, rather than loop on a version that keeps changing).
      const progressed = Object.values(committed.notes).some((ids) => ids.length > 0);
      if (!progressed) return "retry";
    }
    return result.complete ? "pushed" : "retry";
  }

  private sendPresence(): void {
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      if (!this.running) return;
      const noteId = this.presence;
      this.o.backend.setPresence(this.o.me, { noteId, at: Date.now() });

      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      if (noteId) {
        this.heartbeatTimer = setInterval(() => {
          if (this.running && this.presence === noteId) {
            this.o.backend.setPresence(this.o.me, { noteId, at: Date.now() });
          }
        }, PRESENCE_HEARTBEAT_MS);
      }
    }, PRESENCE_DEBOUNCE_MS);
  }
}
