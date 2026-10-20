import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import type { Category, CloudSettings, Note } from "@/types";
import type { VaultDoc } from "@/utils/vault";
import { deleteApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  deleteField,
  disableNetwork,
  doc,
  enableNetwork,
  FieldPath,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { contentToken } from "./token";
import { noteRev } from "./revision";
import type {
  ChangeSet,
  CloudBackend,
  CloudDevice,
  DeviceInfo,
  DevicesSnapshot,
  NoteRef,
  Presence,
  PushOps,
  PushResult,
  Tombstone,
  VaultRead,
} from "./types";
import { NOTE_REF_TEXT } from "./types";
import { toVaultRead } from "./vaultRead";

/*
 * Firestore layout (unchanged since 1.x/3.x, so older installs keep syncing):
 *   notes/{id}                 encrypted note
 *   categories/{icon}          category
 *   vault/config               vault metadata (ADR-012)
 *   handshake/123              write+delete probe
 *   connectedDevices/{uuid}    a device: info, lastSync, presence, and the fan-out queues it publishes for the devices in
 *                              `devicesToSync` (addNotes / deleteNotes / detachNotes / addCategories / deleteCategories)
 * Added by this version (older ones ignore them):
 *   tombstones/{id}            a deleted or detached note's revision, for full syncs (ADR-016)
 *   connectedDevices/{uuid}.fullSyncDue / .presence
 */
const NOTES = "notes";
const CATEGORIES = "categories";
const DEVICES = "connectedDevices";
const TOMBSTONES = "tombstones";
const FULL_SYNC_DUE = "fullSyncDue";
const VAULT = "vault";
const VAULT_DOC_ID = "config";
const HANDSHAKE = "handshake";

const NOTE_QUEUES = ["addNotes", "deleteNotes", "detachNotes"] as const;
const CATEGORY_QUEUES = ["addCategories", "deleteCategories"] as const;
const QUEUES = [...NOTE_QUEUES, ...CATEGORY_QUEUES] as const;

type Queue = (typeof QUEUES)[number];

/*
 * Firestore caps a document at 1 MiB and 40,000 index entries (every field of every queued note is indexed: ~50 entries
 * for a note, ~12 for a reference or a stub), and a device doc holds its queues until every recipient pulled them (one
 * offline for weeks included). Full notes are queued within the FULL budget, references (the receiver fetches the note)
 * within MAX, deletion stubs within HARD. Past that the queues start over: the devices that hadn't pulled them get
 * `fullSyncDue` (a full sync brings them everything, deletions included, see tombstones).
 */
const FANOUT_BUDGET = {
  full: { bytes: 600_000, entries: 20_000 },
  max: { bytes: 900_000, entries: 30_000 },
  hard: { bytes: 1_000_000, entries: 36_000 },
};
/** Per transaction: Firestore allows 500 writes and a 10 MiB request. */
const BATCH_MAX_ENTRIES = 200;
const BATCH_MAX_BYTES = 4_000_000;

const HANDSHAKE_TIMEOUT_MS = 5000;

/** Error codes that won't go away by retrying the same write (e.g. a note over the 1 MiB document limit). */
const PERMANENT_ERRORS = new Set(["invalid-argument", "out-of-range"]);

const errorCode = (e: unknown): string => (e && typeof e === "object" && "code" in e ? String(e.code) : "");

/** Roughly how many index entries a value adds to a document (two per value, one per array element), rounded up. */
export const indexEntries = (value: unknown): number => {
  if (value === null || typeof value !== "object") return 2;
  if (Array.isArray(value)) return value.reduce((n: number, item) => n + 1 + indexEntries(item), 2);
  return Object.values(value).reduce((n: number, item) => n + indexEntries(item), 2);
};

/** Roughly what a value weighs in a document: its JSON, UTF-8 encoded (non-ASCII counted as 3 bytes). */
const byteSize = (value: unknown): number => {
  const json = JSON.stringify(value ?? null);
  let extra = 0;
  for (let i = 0; i < json.length; i++) if (json.charCodeAt(i) > 0x7f) extra += 2;
  return json.length + extra;
};

const countKeys = (o: unknown) => (o && typeof o === "object" ? Object.keys(o).length : 0);

const asMap = <T>(o: unknown): Record<string, T> => (o && typeof o === "object" ? (o as Record<string, T>) : {});

/**
 * A registered device's doc. A doc without `uuid` was re-created by a write landing after the device was removed (older app
 * versions merge `lastSync` or an ack into it): not a device.
 */
const isDevice = (snap: DocumentSnapshot): boolean => snap.exists() && typeof snap.data().uuid === "string";

const toDevice = (snap: DocumentSnapshot): CloudDevice => toDeviceData(snap.id, snap.data() ?? {});

const toDeviceData = (id: string, data: DocumentData): CloudDevice => ({
  uuid: id,
  modelName: data.modelName,
  brand: data.brand,
  lastSync: data.lastSync,
  fullSyncDue: typeof data[FULL_SYNC_DUE] === "number" ? data[FULL_SYNC_DUE] : null,
  devicesToSync: Array.isArray(data.devicesToSync) ? data.devicesToSync : [],
  pendingNotes: countKeys(data.addNotes) + countKeys(data.deleteNotes) + countKeys(data.detachNotes),
  pendingCategories: countKeys(data.addCategories) + countKeys(data.deleteCategories),
  presence:
    data.presence && typeof data.presence === "object" && typeof data.presence.at === "number"
      ? { noteId: data.presence.noteId ?? null, at: data.presence.at }
      : null,
});

/** The queues a device doc carries, as a token: an ack only commits if they're still the applied ones. */
const queueToken = (data: DocumentData): string => contentToken(QUEUES.map((field) => data[field] ?? null));

const clearQueues = () => Object.fromEntries(QUEUES.map((field) => [field, deleteField()]));

const toChangeSet = (id: string, data: DocumentData): ChangeSet => ({
  source: id,
  token: queueToken(data),
  notes: {
    add: asMap<Note | NoteRef>(data.addNotes),
    delete: asMap<Note>(data.deleteNotes),
    detach: asMap<Note>(data.detachNotes),
  },
  categories: {
    add: asMap<Category>(data.addCategories),
    delete: asMap<Category>(data.deleteCategories),
  },
});

const toDevicesSnapshot = (me: string, docs: QueryDocumentSnapshot[], fromServer: boolean): DevicesSnapshot => {
  const devices: CloudDevice[] = [];
  const incoming: ChangeSet[] = [];
  for (const snap of docs) {
    if (!isDevice(snap)) continue;
    const data = snap.data();
    devices.push(toDeviceData(snap.id, data));
    if (snap.id !== me && Array.isArray(data.devicesToSync) && data.devicesToSync.includes(me)) {
      incoming.push(toChangeSet(snap.id, data));
    }
  }
  return { devices, incoming, fromServer };
};

/** One outbox entry, as it will be written. */
export interface Entry {
  queue: Queue;
  key: string;
  /** The note or category (encrypted note, stub, category). */
  value: DocumentData;
}

const isNoteQueue = (queue: Queue) => (NOTE_QUEUES as readonly string[]).includes(queue);

const entriesOf = (ops: PushOps): Entry[] => [
  ...ops.notes.add.map((note): Entry => ({ queue: "addNotes", key: note.id, value: note })),
  ...ops.notes.delete.map((stub): Entry => ({ queue: "deleteNotes", key: stub.id, value: stub })),
  ...ops.notes.detach.map((stub): Entry => ({ queue: "detachNotes", key: stub.id, value: stub })),
  ...ops.categories.add.map((category): Entry => ({ queue: "addCategories", key: category.icon, value: category })),
  ...ops.categories.delete.map((category): Entry => ({ queue: "deleteCategories", key: category.icon, value: category })),
];

/** Whether an entry only applies over older cloud versions (uploads and deletions of notes). */
const isGuarded = (entry: Entry) => entry.queue === "addNotes" || entry.queue === "deleteNotes";

/** The update of the pushing device's doc, as field paths and values, and the devices to tell to run a full sync. */
interface Fanout {
  updates: [string | FieldPath, unknown][];
  flag: string[];
}

/** A queue entry as it would be written, and its weight. */
interface Sized {
  value: DocumentData;
  bytes: number;
  entries: number;
}

const sized = (value: DocumentData): Sized => ({ value, bytes: byteSize(value), entries: indexEntries(value) + 2 });

/** The doc's weight without its queues. */
const withoutQueues = (data: DocumentData) => {
  const rest = Object.fromEntries(Object.entries(data).filter(([field]) => !(QUEUES as readonly string[]).includes(field)));
  return { bytes: byteSize(rest), entries: indexEntries(rest) };
};

/**
 * How `applied` is fanned out (see FANOUT_BUDGET). Every push makes the current recipients the ones waiting, which also
 * drops ids of devices removed since. When an entry doesn't fit, the queues start over with this push's entries, and the
 * devices that were still waiting for what they held get a full sync instead; if this push alone doesn't fit (or
 * `queueing` is off), nothing is queued and every recipient gets one.
 */
export const planFanout = (data: DocumentData, applied: Entry[], recipients: string[], queueing: boolean): Fanout => {
  const updates: Fanout["updates"] = [["lastSync", `${Date.now()}`]];
  const waiting: string[] = Array.isArray(data.devicesToSync) ? data.devicesToSync : [];
  const hasQueued = QUEUES.some((queue) => countKeys(data[queue]) > 0);
  const restart = (): Fanout => {
    updates.push(...QUEUES.map((queue): [string, unknown] => [queue, deleteField()]), ["devicesToSync", []]);
    return { updates, flag: [] };
  };
  // Nobody to deliver to: what's still queued isn't for anyone either.
  if (recipients.length === 0) return hasQueued || waiting.length > 0 ? restart() : { updates, flag: [] };

  const place = (usage: { bytes: number; entries: number }): { entry: Entry; item: Sized }[] | null => {
    const placed: { entry: Entry; item: Sized }[] = [];
    const fits = (budget: { bytes: number; entries: number }, item: Sized) =>
      usage.bytes + item.bytes <= budget.bytes && usage.entries + item.entries <= budget.entries;
    for (const entry of applied) {
      let item: Sized | null = sized(entry.value);
      if (entry.queue === "addNotes" && !fits(FANOUT_BUDGET.full, item)) {
        item = sized({
          id: entry.key,
          type: "text",
          text: NOTE_REF_TEXT,
          rev: noteRev(entry.value as Note),
          ref: true,
        } satisfies NoteRef);
      }
      const budget = entry.queue === "addNotes" || entry.queue === "addCategories" ? FANOUT_BUDGET.max : FANOUT_BUDGET.hard;
      if (!fits(budget, item)) return null;
      usage.bytes += item.bytes;
      usage.entries += item.entries;
      placed.push({ entry, item });
    }
    return placed;
  };

  let placed = queueing ? place({ bytes: byteSize(data), entries: indexEntries(data) }) : null;
  if (placed) {
    // An id is in one queue only (LL-033): the latest operation replaces the others. A field path replaces the whole entry
    // (a merge would keep the fields the previous version had and this one doesn't).
    for (const { entry, item } of placed) {
      const group = isNoteQueue(entry.queue) ? NOTE_QUEUES : CATEGORY_QUEUES;
      for (const queue of group)
        updates.push([new FieldPath(queue, entry.key), queue === entry.queue ? item.value : deleteField()]);
    }
    updates.push(["devicesToSync", recipients]);
    return { updates, flag: [] };
  }

  // Out of room: the queues start over.
  const flag = new Set(waiting.filter((id) => recipients.includes(id)));
  placed = queueing ? place(withoutQueues(data)) : null;
  if (!placed) {
    recipients.forEach((id) => flag.add(id));
    return { updates: restart().updates, flag: [...flag] };
  }
  const queues: Record<string, Record<string, DocumentData>> = Object.fromEntries(QUEUES.map((queue) => [queue, {}]));
  for (const { entry, item } of placed) {
    const group = isNoteQueue(entry.queue) ? NOTE_QUEUES : CATEGORY_QUEUES;
    group.forEach((queue) => delete queues[queue][entry.key]);
    queues[entry.queue][entry.key] = item.value;
  }
  // Whole fields: an update replaces the map (unlike a merge).
  updates.push(...Object.entries(queues), ["devicesToSync", recipients]);
  return { updates, flag: [...flag] };
};

/**
 * A Firebase app and its Firestore. Auto-detected long polling: the default WebChannel stream wedges inside the OS WebViews
 * Tauri runs in (after sleep or a network switch) and never recovers; long polling survives there, and the faster stream is
 * kept where it works. An undefined field is dropped, as JSON does, instead of failing the whole write as an invalid
 * argument (which the push treats as permanent: the note would never sync again until restart). `initializeFirestore` must
 * run before any `getFirestore()`.
 */
const openFirestore = (settings: CloudSettings, name: string): Firestore =>
  initializeFirestore(initializeApp(settings, name), {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  });

/** Proves the settings work with a write + delete round trip (false after HANDSHAKE_TIMEOUT_MS). */
const handshake = async (db: Firestore): Promise<boolean> => {
  const probe = (async () => {
    const ref = doc(db, HANDSHAKE, "123");
    await setDoc(ref, { done: "true" });
    await deleteDoc(ref);
    return true;
  })();
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), HANDSHAKE_TIMEOUT_MS));
  try {
    return await Promise.race([probe, timeout]);
  } catch (e) {
    console.log("handshake:", e);
    return false;
  }
};

export class FirebaseBackend implements CloudBackend {
  /** Every device's push is read by every other one: the free quota bounds how many there can be. */
  readonly deviceLimit = configs.cloud.deviceLimit;

  /** The error callbacks of the open device listeners: told when the app they listen on goes away. */
  private readonly listening = new Set<(error: unknown) => void>();

  private get db(): Firestore | null {
    try {
      return getFirestore(getApp(configs.firebase.appName));
    } catch {
      return null;
    }
  }

  private requireDb(): Firestore {
    const db = this.db;
    if (!db) throw new Error("cloud not initialised");
    return db;
  }

  init(settings: CloudSettings): void {
    // By name: a settings check's own app may exist alongside.
    const current = getApps().find((app) => app.name === configs.firebase.appName);
    if (current) deleteApp(current).catch((error) => console.log("Error deleting app:", error));
    openFirestore(settings, configs.firebase.appName);
    this.dropListeners();
  }

  /** Listeners on a deleted app stop without a word: their owners are told, and listen again (on the new one). */
  private dropListeners(): void {
    const owners = [...this.listening];
    this.listening.clear();
    owners.forEach((onError) => onError(new Error("cloud re-initialised")));
  }

  isActive(): boolean {
    return this.db != null;
  }

  async verify(): Promise<boolean> {
    const db = this.db;
    return db ? handshake(db) : false;
  }

  /** On an app of its own, deleted afterwards: the connection in use isn't touched. */
  async check(settings: CloudSettings): Promise<boolean> {
    const name = `${configs.firebase.appName}-check`;
    const left = getApps().find((app) => app.name === name);
    if (left) await deleteApp(left).catch(() => {});
    try {
      return await handshake(openFirestore(settings, name));
    } catch (e) {
      console.log("settings check:", e);
      return false;
    } finally {
      const app = getApps().find((candidate) => candidate.name === name);
      if (app) await deleteApp(app).catch((error) => console.log("Error deleting app:", error));
    }
  }

  async dispose(): Promise<boolean> {
    try {
      await deleteApp(getApp(configs.firebase.appName));
      this.dropListeners();
      return true;
    } catch {
      return false;
    }
  }

  async reconnect(): Promise<void> {
    const db = this.db;
    if (!db) return;
    try {
      await disableNetwork(db);
      await enableNetwork(db);
    } catch (e) {
      console.log("Error reconnecting firebase:", e);
    }
  }

  // --- Devices ---

  async listDevices(): Promise<CloudDevice[] | null> {
    try {
      const snapshot = await getDocsFromServer(collection(this.requireDb(), DEVICES));
      return snapshot.docs.filter(isDevice).map(toDevice);
    } catch (e) {
      console.log("listDevices:", e);
      return null;
    }
  }

  async registerDevice({ uuid, modelName, brand }: DeviceInfo): Promise<boolean> {
    try {
      await setDoc(doc(this.requireDb(), DEVICES, uuid), {
        uuid,
        modelName: modelName || "web",
        brand: brand || "web",
        lastSync: `${Date.now()}`,
        addCategories: {},
        deleteCategories: {},
        addNotes: {},
        deleteNotes: {},
        detachNotes: {},
        devicesToSync: [],
      });
      return true;
    } catch (e) {
      console.log("registerDevice:", e);
      return false;
    }
  }

  async unregisterDevice(uuid: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.requireDb(), DEVICES, uuid));
      return true;
    } catch (e) {
      console.log("unregisterDevice:", e);
      return false;
    }
  }

  async dropRecipient(uuid: string): Promise<boolean> {
    if (!uuid) return false;
    try {
      const db = this.requireDb();
      const senders = await getDocsFromServer(query(collection(db, DEVICES), where("devicesToSync", "array-contains", uuid)));
      for (const sender of senders.docs) {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(sender.ref);
          if (!snap.exists()) return;
          const recipients: string[] = (snap.data().devicesToSync ?? []).filter((r: string) => r !== uuid);
          tx.update(sender.ref, { devicesToSync: recipients, ...(recipients.length === 0 ? clearQueues() : {}) });
        });
      }
      return true;
    } catch (e) {
      console.log("dropRecipient:", e);
      return false;
    }
  }

  async touchLastSync(uuid: string): Promise<boolean> {
    try {
      await updateDoc(doc(this.requireDb(), DEVICES, uuid), { lastSync: `${Date.now()}` });
      return true;
    } catch (e) {
      console.log("touchLastSync:", e);
      return false;
    }
  }

  async setPresence(uuid: string, presence: Presence): Promise<boolean> {
    try {
      await updateDoc(doc(this.requireDb(), DEVICES, uuid), { presence });
      return true;
    } catch (e) {
      console.log("setPresence:", e);
      return false;
    }
  }

  async clearFullSyncDue(me: string, due: number): Promise<boolean> {
    try {
      const db = this.requireDb();
      const ref = doc(db, DEVICES, me);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists() && snap.data()[FULL_SYNC_DUE] === due) tx.update(ref, { [FULL_SYNC_DUE]: deleteField() });
      });
      return true;
    } catch (e) {
      console.log("clearFullSyncDue:", e);
      return false;
    }
  }

  subscribeDevices(me: string, onDevices: (snapshot: DevicesSnapshot) => void, onError: (error: unknown) => void): () => void {
    const db = this.db;
    if (!db) {
      onError(new Error("cloud not initialised"));
      return () => {};
    }
    this.listening.add(onError);
    const unsubscribe = onSnapshot(
      collection(db, DEVICES),
      { includeMetadataChanges: true },
      // Server-confirmed only: not the cache (LL-027), nor this client's own writes before the server has them.
      (snapshot) =>
        onDevices(toDevicesSnapshot(me, snapshot.docs, !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites)),
      (error) => {
        this.listening.delete(onError);
        onError(error);
      }
    );
    return () => {
      this.listening.delete(onError);
      try {
        unsubscribe();
      } catch {
        // its app was deleted
      }
    };
  }

  async pullDevices(me: string): Promise<DevicesSnapshot | null> {
    try {
      const snapshot = await getDocsFromServer(collection(this.requireDb(), DEVICES));
      return toDevicesSnapshot(me, snapshot.docs, true);
    } catch (e) {
      console.log("pullDevices:", e);
      return null;
    }
  }

  async ackChanges(me: string, change: ChangeSet): Promise<"acked" | "changed" | "error"> {
    try {
      const db = this.requireDb();
      const ref = doc(db, DEVICES, change.source);
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return "acked" as const;
        const data = snap.data();
        const recipients: string[] = Array.isArray(data.devicesToSync) ? data.devicesToSync : [];
        if (!recipients.includes(me)) return "acked" as const;
        // The sender queued more since: this device hasn't applied it yet, so it must stay a recipient.
        if (queueToken(data) !== change.token) return "changed" as const;

        const remaining = recipients.filter((r) => r !== me);
        tx.update(ref, {
          devicesToSync: remaining,
          // deleteField() really removes them: `{}` merged into a map is a no-op, so the queues would never clear.
          ...(remaining.length === 0 ? clearQueues() : {}),
        });
        return "acked" as const;
      });
    } catch (e) {
      console.log("ackChanges:", e);
      return "error";
    }
  }

  // --- Vault ---

  async readVault(): Promise<VaultRead> {
    try {
      // A server read, never the cache: a cached copy of a vault another device has since replaced still matches this
      // device's stale DEK, so the reset would go unnoticed (LL-027). Offline throws -> "error" -> callers skip.
      const snap = await getDocFromServer(doc(this.requireDb(), VAULT, VAULT_DOC_ID));
      return toVaultRead(snap.exists() ? snap.data() : undefined);
    } catch (e) {
      console.log("readVault:", e);
      return { status: "error", vault: null };
    }
  }

  async createVaultExclusive(vault: VaultDoc): Promise<"created" | "exists" | "error"> {
    try {
      const db = this.requireDb();
      return await runTransaction(db, async (tx) => {
        const ref = doc(db, VAULT, VAULT_DOC_ID);
        if ((await tx.get(ref)).exists()) return "exists" as const;
        tx.set(ref, vault);
        return "created" as const;
      });
    } catch (e) {
      console.log("createVaultExclusive:", e);
      return "error";
    }
  }

  async writeVault(vault: VaultDoc): Promise<boolean> {
    try {
      await setDoc(doc(this.requireDb(), VAULT, VAULT_DOC_ID), vault);
      return true;
    } catch (e) {
      console.log("writeVault:", e);
      return false;
    }
  }

  subscribeVault(onRead: (read: VaultRead) => void): () => void {
    const db = this.db;
    if (!db) return () => {};
    return onSnapshot(
      doc(db, VAULT, VAULT_DOC_ID),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache) return;
        onRead(toVaultRead(snap.exists() ? snap.data() : undefined));
      },
      (e) => {
        console.log("subscribeVault:", e);
        onRead({ status: "error", vault: null });
      }
    );
  }

  // --- Data ---

  async fetchNotes(): Promise<Note[] | null> {
    try {
      const snapshot = await getDocsFromServer(collection(this.requireDb(), NOTES));
      return snapshot.docs.map((snap) => snap.data() as Note);
    } catch (e) {
      console.log("fetchNotes:", e);
      return null;
    }
  }

  async fetchTombstones(): Promise<Record<string, Tombstone> | null> {
    try {
      const snapshot = await getDocsFromServer(collection(this.requireDb(), TOMBSTONES));
      const tombstones: Record<string, Tombstone> = {};
      for (const snap of snapshot.docs) {
        const data = snap.data();
        if (typeof data.rev === "number")
          tombstones[snap.id] = { rev: data.rev, ...(data.detach === true && { detach: true }) };
      }
      return tombstones;
    } catch (e) {
      console.log("fetchTombstones:", e);
      return null;
    }
  }

  async pruneTombstones(ids: string[]): Promise<boolean> {
    try {
      const db = this.requireDb();
      for (let i = 0; i < ids.length; i += BATCH_MAX_ENTRIES) {
        const batch = writeBatch(db);
        for (const id of ids.slice(i, i + BATCH_MAX_ENTRIES)) batch.delete(doc(db, TOMBSTONES, id));
        await batch.commit();
      }
      return true;
    } catch (e) {
      console.log("pruneTombstones:", e);
      return false;
    }
  }

  async fetchNote(id: string): Promise<Note | null | undefined> {
    try {
      const snap = await getDocFromServer(doc(this.requireDb(), NOTES, id));
      return snap.exists() ? (snap.data() as Note) : null;
    } catch (e) {
      console.log("fetchNote:", e);
      return undefined;
    }
  }

  async fetchCategories(): Promise<Category[] | null> {
    try {
      const snapshot = await getDocsFromServer(query(collection(this.requireDb(), CATEGORIES), orderBy("order", "asc")));
      return snapshot.docs.map((snap) => snap.data() as Category);
    } catch (e) {
      console.log("fetchCategories:", e);
      return null;
    }
  }

  async writeNotes(notes: Note[]): Promise<boolean> {
    try {
      const db = this.requireDb();
      for (let i = 0; i < notes.length; i += BATCH_MAX_ENTRIES) {
        const batch = writeBatch(db);
        for (const note of notes.slice(i, i + BATCH_MAX_ENTRIES)) batch.set(doc(db, NOTES, note.id), note);
        await batch.commit();
      }
      return true;
    } catch (e) {
      console.log("writeNotes:", e);
      return false;
    }
  }

  private async wipeCollection(name: string): Promise<void> {
    const db = this.requireDb();
    const snapshot = await getDocsFromServer(collection(db, name));
    for (let i = 0; i < snapshot.docs.length; i += BATCH_MAX_ENTRIES) {
      const batch = writeBatch(db);
      for (const snap of snapshot.docs.slice(i, i + BATCH_MAX_ENTRIES)) batch.delete(snap.ref);
      await batch.commit();
    }
  }

  async wipeNotes(): Promise<boolean> {
    try {
      await this.wipeCollection(NOTES);
      await this.wipeCollection(TOMBSTONES);
      return true;
    } catch (e) {
      console.log("wipeNotes:", e);
      return false;
    }
  }

  async wipeCategories(): Promise<boolean> {
    try {
      await this.wipeCollection(CATEGORIES);
      await setDoc(doc(this.requireDb(), CATEGORIES, "none"), defaultCategory);
      return true;
    } catch (e) {
      console.log("wipeCategories:", e);
      return false;
    }
  }

  async push(
    me: string,
    ops: PushOps,
    recipients: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<PushResult> {
    const result: PushResult = {
      committed: { notes: { add: [], delete: [], detach: [] }, categories: { add: [], delete: [] } },
      superseded: [],
      rejected: [],
      complete: true,
    };
    const entries = entriesOf(ops);
    if (entries.length === 0) return result;

    const db = this.db;
    if (!db) {
      result.complete = false;
      return result;
    }

    const record = (entry: Entry) => {
      const { committed } = result;
      if (entry.queue === "addNotes") committed.notes.add.push(entry.key);
      else if (entry.queue === "deleteNotes") committed.notes.delete.push(entry.key);
      else if (entry.queue === "detachNotes") committed.notes.detach.push(entry.key);
      else if (entry.queue === "addCategories") committed.categories.add.push(entry.key);
      else committed.categories.delete.push(entry.key);
    };

    /**
     * One transaction: the guarded entries go through only over older cloud versions, the rest is fanned out to the
     * recipients (`queueing` false: nothing is queued, they all get `fullSyncDue`). Returns what was committed and superseded.
     */
    const commit = (chunk: Entry[], queueing: boolean) =>
      runTransaction(db, async (tx) => {
        const deviceRef = doc(db, DEVICES, me);
        const guarded = chunk.filter(isGuarded);
        const [device, ...current] = await Promise.all([
          tx.get(deviceRef),
          ...guarded.map((entry) => tx.get(doc(db, NOTES, entry.key))),
        ]);
        // Removed from the cloud: nothing to fan out to, and the engine disconnects on the next snapshot.
        if (!device.exists()) throw Object.assign(new Error("device not registered"), { code: "not-found" });

        const cloudVersions = new Map(guarded.map((entry, i) => [entry.key, current[i]]));
        const applied: Entry[] = [];
        const superseded: Note[] = [];
        for (const entry of chunk) {
          const snap = cloudVersions.get(entry.key);
          if (!snap?.exists()) {
            applied.push(entry);
            continue;
          }
          const cloud = snap.data() as Note;
          const cloudRev = noteRev(cloud);
          const rev = noteRev(entry.value as Note);
          const goesThrough =
            entry.queue === "addNotes"
              ? // The same revision may be other content (an older app version doesn't renew it for every change): the
                // engine compares them.
                cloudRev !== rev && cloudRev <= (ops.bases[entry.key] ?? rev)
              : cloudRev <= rev;
          if (goesThrough) applied.push(entry);
          else superseded.push(cloud);
        }
        // Nothing to write: no write to this device's doc either (it would wake every device's listener for nothing).
        if (applied.length === 0) return { committed: [], superseded };

        const fanout = planFanout(device.data(), applied, recipients, queueing);
        const flagged = await Promise.all(fanout.flag.map((id) => tx.get(doc(db, DEVICES, id))));

        for (const entry of applied) {
          const ref = doc(db, isNoteQueue(entry.queue) ? NOTES : CATEGORIES, entry.key);
          if (entry.queue === "addNotes" || entry.queue === "addCategories") tx.set(ref, entry.value);
          else tx.delete(ref);
          if (entry.queue === "deleteNotes" || entry.queue === "detachNotes") {
            const tombstone: Tombstone = {
              rev: noteRev(entry.value as Note),
              ...(entry.queue === "detachNotes" && { detach: true }),
            };
            tx.set(doc(db, TOMBSTONES, entry.key), tombstone);
          }
        }
        for (const snap of flagged) {
          if (isDevice(snap)) tx.update(snap.ref, { [FULL_SYNC_DUE]: Date.now() });
        }
        const [[field, value], ...more] = fanout.updates;
        tx.update(deviceRef, field, value, ...more.flat());

        return { committed: applied, superseded };
      });

    let done = 0;
    /** Isolates what a permanent error is about: halves the chunk until the culprit is alone. False: retry later. */
    const commitIsolating = async (chunk: Entry[], queueing = true): Promise<boolean> => {
      try {
        const { committed, superseded } = await commit(chunk, queueing);
        committed.forEach(record);
        result.superseded.push(...superseded);
        done += chunk.length;
        onProgress?.(done, entries.length);
        return true;
      } catch (e) {
        if (!PERMANENT_ERRORS.has(errorCode(e))) {
          console.log("push:", e);
          return false;
        }
        if (chunk.length > 1) {
          const half = Math.ceil(chunk.length / 2);
          return (
            (await commitIsolating(chunk.slice(0, half), queueing)) && (await commitIsolating(chunk.slice(half), queueing))
          );
        }
        // Refused alone: maybe for this device's doc (its queues outgrew what the budgets estimate), not the entry. Once more
        // without queueing; refused again, it's the entry (e.g. a note over the 1 MiB document limit).
        if (queueing) return commitIsolating(chunk, false);
        console.log(`push: "${chunk[0].key}" rejected:`, e);
        result.rejected.push(`${chunk[0].queue}:${chunk[0].key}`);
        done += 1;
        onProgress?.(done, entries.length);
        return true;
      }
    };

    let chunk: Entry[] = [];
    let chunkBytes = 0;
    for (const entry of entries) {
      const bytes = byteSize(entry.value) * 2; // the document and its fan-out entry
      if (chunk.length >= BATCH_MAX_ENTRIES || (chunk.length > 0 && chunkBytes + bytes > BATCH_MAX_BYTES)) {
        if (!(await commitIsolating(chunk))) {
          result.complete = false;
          return result;
        }
        chunk = [];
        chunkBytes = 0;
      }
      chunk.push(entry);
      chunkBytes += bytes;
    }
    if (!(await commitIsolating(chunk))) result.complete = false;
    return result;
  }
}
