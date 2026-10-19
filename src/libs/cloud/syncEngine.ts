import type { UnknownAction } from "@reduxjs/toolkit";

import type { Category, Note, RootState } from "@/types";
import type { VaultDoc } from "@/utils/vault";

import { createPlanner, isEmptyPlan, reconcileCategories, type LocalNotes, type SyncPlan } from "./merge";
import { deletionStub, forUpload, noteRev, TOMBSTONE_TTL_MS } from "./revision";
import type { ChangeSet, CloudBackend, CloudDevice, DevicesSnapshot, NoteRef, PushOps } from "./types";

/*
 * The sync engine (ADR-016): listens to the device docs and the vault, merges what other devices queued for this one,
 * pushes this device's outbox, and acknowledges. Every step runs one at a time, in order, so a merge never interleaves with
 * a push: incoming changes are always merged before this device pushes over them.
 */

/** Wait after an outbox change, so a burst of changes goes out as one push. */
const PUSH_DEBOUNCE_MS = 200;
/**
 * Pushes go out at most this often: a push costs reads on every device (its doc changes under their listeners), and an
 * open note being typed in commits every second or two. It's also how fast the others see the typing.
 */
const PUSH_MIN_INTERVAL_MS = 2000;
/**
 * Acknowledging only lets the sender clear its queues, and costs a read and a write here plus a read on every device: it
 * waits for the sender to go quiet for ACK_QUIET_MS, at most ACK_MAX_WAIT_MS. Merging doesn't wait.
 */
const ACK_QUIET_MS = 5000;
const ACK_MAX_WAIT_MS = 30_000;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 5 * 60 * 1000;
/**
 * The listeners are re-opened this often, then the devices are read again: a listener can stop without an error (a wedged
 * transport), and a read "from the server" is answered by a listener on the same data. Re-opening resumes from where the
 * listeners were (only changes are read).
 */
const POLL_MS = 5 * 60 * 1000;
/** A task with no progress for this long is stuck on the transport: the poll re-opens it even then. */
const TASK_STALL_MS = 60_000;
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
  adoptLegacyOutbox(ids: string[]): UnknownAction;
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
  /** Whether this device's key opens the vault; null without a key (locked: nothing to tell). */
  matches(vault: VaultDoc): boolean | null;
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
  /** Writes the persisted state now: applied changes are on disk before they're acknowledged. Rejects if they aren't. */
  persist(): Promise<void>;
  /** Commits the open editors' pending edits, so a merge sees them. */
  flushEditors(): void;
  /** Appended to the title of a conflict copy. */
  conflictSuffix(): string;
  events: SyncEvents;
  /** Overrides the waits (tests). */
  timing?: Partial<Timing>;
}

interface Timing {
  pushMinInterval: number;
  ackQuiet: number;
  ackMaxWait: number;
}

const isRef = (entry: Note | NoteRef): entry is NoteRef => (entry as NoteRef).ref === true;

const localNotes = (state: RootState): LocalNotes => ({
  items: state.notes.items,
  trash: state.notes.temporaryItems,
  purged: state.notes.purged ?? {},
  pendingUploads: state.notes.cloud.items.add,
  pendingDeletes: state.notes.cloud.items.delete,
});

/** An outbox entry, as the backend reports a rejected one: `<queue>:<key>`. */
const entryKey = (queue: string, key: string) => `${queue}:${key}`;

const hasOutbox = (state: RootState, skip: Set<string>): boolean => {
  const notes = state.notes.cloud.items;
  const categories = state.categories.cloud.items;
  return (
    [
      ["addNotes", notes.add],
      ["deleteNotes", notes.delete],
      ["detachNotes", notes.detach ?? {}],
      ["addCategories", categories.add],
      ["deleteCategories", categories.delete],
    ] as const
  ).some(([queue, entries]) => Object.keys(entries).some((key) => !skip.has(entryKey(queue, key))));
};

export class SyncEngine {
  private readonly o: SyncEngineOptions;

  private running = false;
  private tail: Promise<unknown> = Promise.resolve();

  private devices: CloudDevice[] = [];
  /** The latest server snapshot not processed yet. */
  private pendingSnapshot: DevicesSnapshot | null = null;
  /** Counts the listener's snapshots: a read that started before one is older than it. */
  private snapshotSeq = 0;
  /** A server snapshot was merged since start: pushes may go out. */
  private devicesReady = false;
  /** The vault was read from the server and opens with this device's key. */
  private vaultOk = false;
  /** Change sets merged but not acknowledged yet (sender -> token): a retry only acknowledges. */
  private readonly merged = new Map<string, string>();
  /** Merged change sets waiting to be acknowledged (see ACK_QUIET_MS), by sender. */
  private readonly toAck = new Map<string, ChangeSet>();
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private ackSince: number | null = null;
  /** The `fullSyncDue` this device last ran its full sync for. */
  private fullSyncDone: number | null = null;
  /** A full sync is running: it handles `fullSyncDue` itself. */
  private fullSyncing = false;
  /** Outbox entries (`entryKey`) the backend refused for good: not retried until the next launch. */
  private readonly rejected = new Set<string>();
  private lastPushAt = 0;
  /** When the running task started, or last made progress (null: idle). */
  private busySince: number | null = null;

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

  private readonly timing: Timing;

  constructor(options: SyncEngineOptions) {
    this.o = options;
    this.timing = {
      pushMinInterval: PUSH_MIN_INTERVAL_MS,
      ackQuiet: ACK_QUIET_MS,
      ackMaxWait: ACK_MAX_WAIT_MS,
      ...options.timing,
    };
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** The note open in an editor here (null: none), as set by `setPresence`. */
  get openNote(): string | null {
    return this.presence;
  }

  /** Starts listening and pushing. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.devicesReady = false;
    this.vaultOk = false;
    this.adoptLegacyOutbox();
    this.subscribe();
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);

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
    [this.pushTimer, this.retryTimer, this.resubscribeTimer, this.presenceTimer, this.ackTimer].forEach(
      (t) => t && clearTimeout(t)
    );
    [this.pollTimer, this.heartbeatTimer].forEach((t) => t && clearInterval(t));
    this.pushTimer = this.retryTimer = this.resubscribeTimer = this.presenceTimer = this.ackTimer = null;
    this.pollTimer = this.heartbeatTimer = null;
    this.retryDelay = 0;
    this.pendingSnapshot = null;
    // Merged again (it's idempotent) and acknowledged on the next start.
    this.merged.clear();
    this.toAck.clear();
    this.ackSince = null;
  }

  /** The outbox changed: push soon (see PUSH_MIN_INTERVAL_MS). */
  kick(delay: number = PUSH_DEBOUNCE_MS): void {
    if (!this.running) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    const wait = Math.max(delay, this.lastPushAt + this.timing.pushMinInterval - Date.now());
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.serial(() => this.pushPass());
    }, wait);
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
      this.fullSyncing = true;
      try {
        this.adoptLegacyOutbox();
        const seq = this.snapshotSeq;
        const snapshot = await this.o.backend.pullDevices(this.o.me);
        if (!snapshot) return false;
        if (this.snapshotSeq === seq) this.pendingSnapshot = snapshot;
        if (!(await this.processDevices())) return false;
        if (!(await this.reconcile(true))) return false;
        // What another device asked for: done.
        const due = this.devices.find((device) => device.uuid === this.o.me)?.fullSyncDue;
        if (due != null) {
          this.fullSyncDone = due;
          await this.o.backend.clearFullSyncDue(this.o.me, due);
        }
        if (!(await this.flushAcks())) return false;
        const pushed = await this.pushOutbox(onProgress);
        if (pushed === "nothing") await this.o.backend.touchLastSync(this.o.me);
        return pushed !== "retry";
      } finally {
        this.fullSyncing = false;
      }
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
    const run = this.tail.then(async () => {
      if (!this.running && !force) return undefined as T;
      this.busySince = Date.now();
      try {
        return await task();
      } finally {
        this.busySince = null;
      }
    });
    this.tail = run.catch((e) => console.log("sync:", e));
    return run;
  }

  /** See POLL_MS: re-opens the transport (unless a task is making progress over it), then reads the devices again. */
  private poll(): void {
    const stalled = this.busySince === null || Date.now() - this.busySince > TASK_STALL_MS;
    (stalled ? this.o.backend.reconnect() : Promise.resolve()).then(() => this.pull());
  }

  /** Uploads an older app version left queued (see `adoptLegacyOutbox` in the notes slice). */
  private adoptLegacyOutbox(): void {
    const { notes } = this.o.store.getState();
    const outbox = notes.cloud.items;
    const legacy = Object.keys(outbox.add).filter((id) => {
      const note = notes.items.find((n) => n.id === id);
      return note && ((note.rev === undefined && note.syncedRev === undefined && !note.local) || id in outbox.delete);
    });
    if (legacy.length > 0) this.o.store.dispatch(this.o.actions.adoptLegacyOutbox(legacy));
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
        this.snapshotSeq++;
        this.pendingSnapshot = snapshot;
        this.serial(() => this.processDevices());
      },
      onError
    );
    const vault = backend.subscribeVault((read) => {
      if (read.status === "error") return;
      const opens = read.status === "present" ? this.o.crypto.matches(read.vault) : false;
      if (opens === null) return;
      if (!opens) {
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
      const seq = this.snapshotSeq;
      const snapshot = await this.o.backend.pullDevices(this.o.me);
      if (!snapshot) return;
      // A listener snapshot that came meanwhile is the newer one.
      if (this.snapshotSeq === seq) this.pendingSnapshot = snapshot;
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
    // Locked here (no key): it can't be told, and nothing can be synced either.
    const opens = read.status === "present" ? this.o.crypto.matches(read.vault) : false;
    if (opens === null) return false;
    if (!opens) {
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

    const mine = snapshot.devices.find((device) => device.uuid === this.o.me);
    if (!mine) {
      this.stop();
      this.o.events.onRemoved();
      return false;
    }
    // A presence left by a session that ended without clearing it (page reloaded, app killed): cleared now, rather than
    // shown to the others until it expires. Not while a change of it is about to go out.
    if (this.running && mine.presence?.noteId && mine.presence.noteId !== this.presence && !this.presenceTimer) {
      this.sendPresence();
    }

    if (!this.vaultOk && !(await this.checkVault())) {
      this.retry();
      return false;
    }

    let complete = true;
    for (const change of snapshot.incoming) {
      if (!(await this.processChange(change))) complete = false;
    }

    // Another device couldn't queue its changes for this one (its queues ran out of room): they're in the cloud.
    const due = mine.fullSyncDue;
    if (complete && due != null && !this.fullSyncing) {
      if (due !== this.fullSyncDone) {
        if (await this.reconcile(false)) this.fullSyncDone = due;
        else complete = false;
      }
      if (due === this.fullSyncDone) await this.o.backend.clearFullSyncDue(this.o.me, due);
    }
    this.devicesReady = true;

    // Not while a retry is pending: it pulls and pushes when due (a snapshot alone mustn't skip the backoff).
    if (!complete) this.retry();
    else if (!this.retryTimer) this.kick();
    return complete;
  }

  private async processChange(change: ChangeSet): Promise<boolean> {
    if (this.merged.get(change.source) !== change.token) {
      if (!(await this.mergeChange(change))) return false;
      this.merged.set(change.source, change.token);
    }
    const waiting = this.toAck.get(change.source);
    this.toAck.set(change.source, change);
    if (waiting?.token !== change.token || !this.ackTimer) this.scheduleAck();
    return true;
  }

  /** Acknowledges once the senders have gone quiet (see ACK_QUIET_MS). */
  private scheduleAck(): void {
    // Not started (a full sync): it acknowledges at its end.
    if (!this.running) return;
    const now = Date.now();
    this.ackSince ??= now;
    if (this.ackTimer) clearTimeout(this.ackTimer);
    const wait = Math.max(0, Math.min(this.timing.ackQuiet, this.ackSince + this.timing.ackMaxWait - now));
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null;
      this.serial(() => this.flushAcks());
    }, wait);
  }

  /** Acknowledges what was merged. False if one couldn't be (retried later). */
  private async flushAcks(): Promise<boolean> {
    this.ackSince = null;
    let ok = true;
    for (const [source, change] of [...this.toAck]) {
      // "changed": the sender queued more meanwhile, its next snapshot brings it.
      const ack = await this.o.backend.ackChanges(this.o.me, change);
      if (ack === "error") {
        ok = false;
        continue;
      }
      this.toAck.delete(source);
      this.merged.delete(source);
    }
    if (!ok) this.retry();
    return ok;
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
      if (!planner.offer(entry.id, noteRev(entry as Note), !isRef(entry))) continue;
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

    // From here to the report nothing awaits: the plan is made against the current state, edits included, and open
    // editors reload before anything else runs.
    this.o.flushEditors();
    const planner = createPlanner(localNotes(this.o.store.getState()), this.o.conflictSuffix());
    for (const entry of adds) {
      // Settles what the revision alone does (e.g. a stale replay), then merges the rest.
      if (!planner.offer(entry.id, noteRev(entry as Note), !isRef(entry))) continue;
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

    // Told before the write: an open editor reloads now, before a batched commit of its copy (without the change) lands.
    if (plan.changed.length > 0 || categories) {
      this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories, full: false });
    }
    return this.persisted();
  }

  /** Whether what was just merged is on disk: until it is, nothing gets acknowledged (the sender keeps it queued). */
  private async persisted(): Promise<boolean> {
    try {
      await this.o.persist();
      return true;
    } catch (e) {
      console.log("sync: persisting:", e);
      return false;
    }
  }

  /** Merges the whole cloud with this device's notes and categories. */
  private async reconcile(full: boolean): Promise<boolean> {
    const { backend, crypto, store } = this.o;
    const cloudNotes = await backend.fetchNotes();
    if (!cloudNotes) return false;
    const cloudCategories = await backend.fetchCategories();
    if (!cloudCategories) return false;
    const tombstones = await backend.fetchTombstones();
    if (!tombstones) return false;

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
    planner.reconcile(versions, cloudRevs, tombstones);
    const plan = planner.plan();
    if (!isEmptyPlan(plan)) store.dispatch(this.o.actions.applyNotesPlan(plan));

    const categoryPlan = reconcileCategories(state.categories.items, state.categories.cloud.items, cloudCategories);
    store.dispatch(this.o.actions.applyCategoriesPlan(categoryPlan));

    this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories: true, full });
    if (!(await this.persisted())) return false;

    const expired = Object.keys(tombstones).filter((id) => Date.now() - tombstones[id].rev > TOMBSTONE_TTL_MS);
    if (expired.length > 0) await backend.pruneTombstones(expired);
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
    if (plan.changed.length > 0) {
      this.o.events.onApplied({ changed: plan.changed, conflicts: plan.conflicts, categories: false, full: false });
    }
    return this.persisted();
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
    this.adoptLegacyOutbox();
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
      if (this.rejected.has(entryKey("addNotes", id))) continue;
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
      if (this.rejected.has(entryKey("deleteNotes", id))) continue;
      const stub = deletionStub(entry);
      ops.notes.delete.push(stub);
      sent.notes.delete.set(id, { id, entry, rev: noteRev(stub) });
    }
    for (const [id, entry] of Object.entries(outbox.detach ?? {})) {
      if (this.rejected.has(entryKey("detachNotes", id))) continue;
      const stub = deletionStub(entry);
      ops.notes.detach.push(stub);
      sent.notes.detach.set(id, { id, entry, rev: noteRev(stub) });
    }
    for (const [icon, entry] of Object.entries(categoryOutbox.add)) {
      if (this.rejected.has(entryKey("addCategories", icon))) continue;
      ops.categories.add.push({ ...entry, index: entry.index ?? false, order: entry.order ?? 1 });
      sent.categories.add.set(icon, { id: icon, entry, rev: 0 });
    }
    for (const [icon, entry] of Object.entries(categoryOutbox.delete)) {
      if (this.rejected.has(entryKey("deleteCategories", icon))) continue;
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
    this.lastPushAt = Date.now();
    const result = await backend.push(me, ops, recipients, (done, all) => {
      this.busySince = Date.now(); // progressing (see TASK_STALL_MS)
      onProgress?.(done, all);
    });

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
