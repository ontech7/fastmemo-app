import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import type { Category, CloudSettings, Note } from "@/types";
import { isVaultDoc, VAULT_VERSION, type VaultDoc } from "@/utils/vault";
import { deleteApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  arrayUnion,
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
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
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
  VaultRead,
} from "./types";
import { NOTE_REF_TEXT } from "./types";

/*
 * Firestore layout (unchanged since 1.x/3.x, so older installs keep syncing):
 *   notes/{id}                 encrypted note
 *   categories/{icon}          category
 *   vault/config               vault metadata (ADR-012)
 *   handshake/123              write+delete probe
 *   connectedDevices/{uuid}    a device: info, lastSync, presence, and the fan-out queues it publishes for the devices in
 *                              `devicesToSync` (addNotes / deleteNotes / detachNotes / addCategories / deleteCategories)
 */
const NOTES = "notes";
const CATEGORIES = "categories";
const DEVICES = "connectedDevices";
const VAULT = "vault";
const VAULT_DOC_ID = "config";
const HANDSHAKE = "handshake";

const NOTE_QUEUES = ["addNotes", "deleteNotes", "detachNotes"] as const;
const CATEGORY_QUEUES = ["addCategories", "deleteCategories"] as const;
const QUEUES = [...NOTE_QUEUES, ...CATEGORY_QUEUES] as const;
/** Set on a device doc when its queues ran out of room: the receivers run a full sync. Older app versions ignore it. */
const RESYNC = "resync";
/** Everything an ack clears once no recipient is left. */
const QUEUED_FIELDS = [...QUEUES, RESYNC] as const;

type Queue = (typeof QUEUES)[number];

/*
 * Firestore caps a document at 1 MiB, and a device doc holds its queues until every recipient pulled them (one offline for
 * weeks included). Full notes are queued while the queues stay under FANOUT_FULL_BUDGET, references (the receiver fetches the
 * note) up to FANOUT_MAX_BUDGET, and past that uploads aren't queued: the receivers are told to run a full sync instead.
 * Deletions can't be left to a full sync (absence never deletes), so their stubs (~100 bytes) get the room left up to
 * FANOUT_HARD_LIMIT.
 */
const FANOUT_FULL_BUDGET = 600_000;
const FANOUT_MAX_BUDGET = 900_000;
const FANOUT_HARD_LIMIT = 1_000_000;
/** Per transaction: Firestore allows 500 writes and a 10 MiB request. */
const BATCH_MAX_ENTRIES = 200;
const BATCH_MAX_BYTES = 4_000_000;

const HANDSHAKE_TIMEOUT_MS = 5000;

/** Error codes that won't go away by retrying the same write (e.g. a note over the 1 MiB document limit). */
const PERMANENT_ERRORS = new Set(["invalid-argument", "out-of-range"]);

const errorCode = (e: unknown): string => (e && typeof e === "object" && "code" in e ? String(e.code) : "");

/** Roughly what a value weighs in a document: its JSON, UTF-8 encoded (non-ASCII counted as 3 bytes). */
const byteSize = (value: unknown): number => {
  const json = JSON.stringify(value ?? null);
  let extra = 0;
  for (let i = 0; i < json.length; i++) if (json.charCodeAt(i) > 0x7f) extra += 2;
  return json.length + extra;
};

const countKeys = (o: unknown) => (o && typeof o === "object" ? Object.keys(o).length : 0);

const asMap = <T>(o: unknown): Record<string, T> => (o && typeof o === "object" ? (o as Record<string, T>) : {});

const toDevice = (data: DocumentData): CloudDevice => ({
  uuid: data.uuid,
  modelName: data.modelName,
  brand: data.brand,
  lastSync: data.lastSync,
  devicesToSync: Array.isArray(data.devicesToSync) ? data.devicesToSync : [],
  pendingNotes: countKeys(data.addNotes) + countKeys(data.deleteNotes) + countKeys(data.detachNotes),
  pendingCategories: countKeys(data.addCategories) + countKeys(data.deleteCategories),
  presence:
    data.presence && typeof data.presence === "object" && typeof data.presence.at === "number"
      ? { noteId: data.presence.noteId ?? null, at: data.presence.at }
      : null,
});

/** The queues a device doc carries, as a token: an ack only commits if they're still the applied ones. */
const queueToken = (data: DocumentData): string => contentToken(QUEUED_FIELDS.map((field) => data[field] ?? null));

const clearQueues = () => Object.fromEntries(QUEUED_FIELDS.map((field) => [field, deleteField()]));

const toChangeSet = (data: DocumentData): ChangeSet => ({
  source: data.uuid,
  token: queueToken(data),
  resync: data[RESYNC] != null,
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
    const data = snap.data();
    devices.push(toDevice(data));
    if (data.uuid !== me && Array.isArray(data.devicesToSync) && data.devicesToSync.includes(me)) {
      incoming.push(toChangeSet(data));
    }
  }
  return { devices, incoming, fromServer };
};

const toVaultRead = (data: DocumentData | undefined): VaultRead => {
  if (!data) return { status: "absent", vault: null };
  // A malformed doc, or one written by a newer app version (a KDF/format this build can't handle), is an error: never
  // unlock against it nor overwrite it.
  if (!isVaultDoc(data)) return { status: "error", vault: null };
  if (typeof data.version === "number" && data.version > VAULT_VERSION) return { status: "error", vault: null };
  return { status: "present", vault: data };
};

/** One outbox entry, as it will be written. */
interface Entry {
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

export class FirebaseBackend implements CloudBackend {
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
    if (getApps().length) {
      deleteApp(getApp(configs.firebase.appName)).catch((error) => console.log("Error deleting app:", error));
    }
    const app = initializeApp(settings, configs.firebase.appName);
    // Auto-detected long polling: the default WebChannel stream wedges inside the OS WebViews Tauri runs in (after sleep or
    // a network switch) and never recovers; long polling survives there, and the faster stream is kept where it works.
    // Must run before any getFirestore().
    initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }

  isActive(): boolean {
    return this.db != null;
  }

  async verify(): Promise<boolean> {
    const db = this.db;
    if (!db) return false;
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
  }

  async dispose(): Promise<boolean> {
    try {
      await deleteApp(getApp(configs.firebase.appName));
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
      return snapshot.docs.map((snap) => toDevice(snap.data()));
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
      await setDoc(doc(this.requireDb(), DEVICES, uuid), { lastSync: `${Date.now()}` }, { merge: true });
      return true;
    } catch (e) {
      console.log("touchLastSync:", e);
      return false;
    }
  }

  async setPresence(uuid: string, presence: Presence): Promise<boolean> {
    try {
      await setDoc(doc(this.requireDb(), DEVICES, uuid), { presence }, { merge: true });
      return true;
    } catch (e) {
      console.log("setPresence:", e);
      return false;
    }
  }

  subscribeDevices(me: string, onDevices: (snapshot: DevicesSnapshot) => void, onError: (error: unknown) => void): () => void {
    const db = this.db;
    if (!db) {
      onError(new Error("cloud not initialised"));
      return () => {};
    }
    return onSnapshot(
      collection(db, DEVICES),
      { includeMetadataChanges: true },
      // Server-confirmed only: not the cache (LL-027), nor this client's own writes before the server has them.
      (snapshot) =>
        onDevices(toDevicesSnapshot(me, snapshot.docs, !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites)),
      onError
    );
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

    /** One transaction: the guarded entries go through only over older cloud versions. Returns what was superseded. */
    const commit = (chunk: Entry[]) =>
      runTransaction(db, async (tx) => {
        const deviceRef = doc(db, DEVICES, me);
        const guarded = chunk.filter(isGuarded);
        const [device, ...current] = await Promise.all([
          tx.get(deviceRef),
          ...guarded.map((entry) => tx.get(doc(db, NOTES, entry.key))),
        ]);
        // Removed from the cloud: nothing to fan out to, and the engine disconnects on the next snapshot.
        if (!device.exists()) throw Object.assign(new Error("device not registered"), { code: "not-found" });

        const cloudRevs = new Map(guarded.map((entry, i) => [entry.key, current[i]]));
        const applied: Entry[] = [];
        const already: Entry[] = [];
        const superseded: Note[] = [];

        for (const entry of chunk) {
          const snap = cloudRevs.get(entry.key);
          if (!snap?.exists()) {
            applied.push(entry);
            continue;
          }
          const cloud = snap.data() as Note;
          const cloudRev = noteRev(cloud);
          const rev = noteRev(entry.value as Note);
          if (entry.queue === "addNotes") {
            // Already there: an earlier push committed it, or another device made the same conflict copy.
            if (cloudRev === rev) already.push(entry);
            else if (cloudRev <= (ops.bases[entry.key] ?? rev)) applied.push(entry);
            else superseded.push(cloud);
          } else if (cloudRev <= rev) {
            applied.push(entry);
          } else {
            superseded.push(cloud);
          }
        }

        const deviceData = device.data();
        let queued = byteSize(QUEUED_FIELDS.map((field) => deviceData[field] ?? null));
        let resync = false;
        // field path, value, field path, value...
        const deviceUpdate: unknown[] = ["lastSync", `${Date.now()}`];

        for (const entry of applied) {
          const ref = doc(db, isNoteQueue(entry.queue) ? NOTES : CATEGORIES, entry.key);
          if (entry.queue === "addNotes" || entry.queue === "addCategories") tx.set(ref, entry.value);
          else tx.delete(ref);

          if (recipients.length === 0) continue;

          // An id is in one queue only (LL-033): the latest operation replaces the others. A field path replaces the whole
          // entry (a merge would keep the fields the previous version had and this one doesn't).
          const group = isNoteQueue(entry.queue) ? NOTE_QUEUES : CATEGORY_QUEUES;

          let fanout = entry.value;
          let size = byteSize(fanout);
          if (entry.queue === "addNotes" && queued + size > FANOUT_FULL_BUDGET) {
            fanout = {
              id: entry.key,
              type: "text",
              text: NOTE_REF_TEXT,
              rev: noteRev(entry.value as Note),
              ref: true,
            } satisfies NoteRef;
            size = byteSize(fanout);
          }
          const isUpload = entry.queue === "addNotes" || entry.queue === "addCategories";
          if (queued + size > (isUpload ? FANOUT_MAX_BUDGET : FANOUT_HARD_LIMIT)) {
            // Not queued: the full sync brings it. An older operation on the id mustn't be replayed instead.
            resync = true;
            for (const queue of group) deviceUpdate.push(new FieldPath(queue, entry.key), deleteField());
            continue;
          }
          queued += size;

          for (const queue of group) {
            deviceUpdate.push(new FieldPath(queue, entry.key), queue === entry.queue ? fanout : deleteField());
          }
        }

        const waiting = Array.isArray(deviceData.devicesToSync) && deviceData.devicesToSync.length > 0;
        if (recipients.length > 0 && applied.length > 0) {
          deviceUpdate.push("devicesToSync", arrayUnion(...recipients));
        }
        if (resync) deviceUpdate.push(RESYNC, Date.now());
        // Everyone pulled the queues since it was set: an older app version acknowledging last doesn't clear it.
        else if (!waiting && deviceData[RESYNC] != null) deviceUpdate.push(RESYNC, deleteField());
        const [field, value, ...more] = deviceUpdate;
        tx.update(deviceRef, field as string | FieldPath, value, ...more);

        return { committed: [...applied, ...already], superseded };
      });

    let done = 0;
    /** Isolates what a permanent error is about: halves the chunk until the culprit is alone. False: retry later. */
    const commitIsolating = async (chunk: Entry[]): Promise<boolean> => {
      try {
        const { committed, superseded } = await commit(chunk);
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
        if (chunk.length === 1) {
          console.log(`push: "${chunk[0].key}" rejected:`, e);
          result.rejected.push(chunk[0].key);
          done += 1;
          onProgress?.(done, entries.length);
          return true;
        }
        const half = Math.ceil(chunk.length / 2);
        return (await commitIsolating(chunk.slice(0, half))) && (await commitIsolating(chunk.slice(half)));
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
