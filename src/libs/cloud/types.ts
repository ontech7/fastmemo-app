import type { Category, CloudSettings, Note } from "@/types";
import type { VaultDoc } from "@/utils/vault";

/**
 * The cloud as the sync engine sees it (ADR-016). `FirebaseBackend` implements it on Firestore, `ServerBackend` on a
 * self-hosted FastMemo server (ADR-017). Reads that drive a decision return `null` (or `"error"`) when they fail, never
 * an empty value: "couldn't read" must not look like "nothing there" (LL-023).
 */
export interface CloudBackend {
  /** How many devices may be connected at once (this one included). */
  readonly deviceLimit: number;
  /** The engine's pacing for this cloud (unset: the defaults, sized for Firestore's costs). */
  readonly pacing?: Partial<Pacing>;

  /** (Re)initialises the connection for these settings. */
  init(settings: CloudSettings): void;
  /** Whether a connection is initialised (not whether it's reachable). */
  isActive(): boolean;
  /** Proves the settings work with a write + delete round trip. */
  verify(): Promise<boolean>;
  /** Tears the connection down. */
  dispose(): Promise<boolean>;
  /** Drops and re-opens the transport (recovers a channel wedged by sleep or a network switch). */
  reconnect(): Promise<void>;

  // --- Devices ---

  listDevices(): Promise<CloudDevice[] | null>;
  /** Registers a device with empty queues. */
  registerDevice(device: DeviceInfo): Promise<boolean>;
  unregisterDevice(uuid: string): Promise<boolean>;
  /** Removes `uuid` from every device's recipients (a removed device will never pull them). */
  dropRecipient(uuid: string): Promise<boolean>;
  /** Updates a registered device (never re-creates a removed one). */
  touchLastSync(uuid: string): Promise<boolean>;
  setPresence(uuid: string, presence: Presence): Promise<boolean>;
  /** Clears `me`'s `fullSyncDue` once that full sync ran, unless another device set it again since. */
  clearFullSyncDue(me: string, due: number): Promise<boolean>;
  /** Live device list, with the changes queued for `me`. `onError` fires when the listener dies (call again to resume). */
  subscribeDevices(me: string, onSnapshot: (snapshot: DevicesSnapshot) => void, onError: (error: unknown) => void): Unsubscribe;
  /** One-off server read of the same data (fallback when a listener is silently dead). */
  pullDevices(me: string): Promise<DevicesSnapshot | null>;
  /**
   * After `change` was applied (and persisted): removes `me` from its recipients, and clears its queues once nobody is left,
   * only if they still hold exactly what was applied. "changed" means the sender queued more meanwhile: apply again.
   */
  ackChanges(me: string, change: ChangeSet): Promise<"acked" | "changed" | "error">;

  // --- Vault ---

  readVault(): Promise<VaultRead>;
  createVaultExclusive(vault: VaultDoc): Promise<"created" | "exists" | "error">;
  writeVault(vault: VaultDoc): Promise<boolean>;
  /** Live vault doc (server-confirmed reads only). */
  subscribeVault(onRead: (read: VaultRead) => void): Unsubscribe;

  // --- Data ---

  /** Every stored note (encrypted), or null when the read failed. */
  fetchNotes(): Promise<Note[] | null>;
  /** The deletions and detaches recorded by `push` (id -> tombstone), or null when the read failed. */
  fetchTombstones(): Promise<Record<string, Tombstone> | null>;
  /** Removes tombstones (expired ones). */
  pruneTombstones(ids: string[]): Promise<boolean>;
  /** One stored note (encrypted): null when it doesn't exist, undefined when the read failed. */
  fetchNote(id: string): Promise<Note | null | undefined>;
  fetchCategories(): Promise<Category[] | null>;
  /** Writes notes as they are, without fan-out (vault migration). */
  writeNotes(notes: Note[]): Promise<boolean>;
  /** Deletes every note, and the tombstones with them. */
  wipeNotes(): Promise<boolean>;
  /** Deletes every category but the default one. */
  wipeCategories(): Promise<boolean>;
  /**
   * Applies the outbox (all or nothing per batch), records a tombstone for each deletion and detach, and fans it out to
   * `recipients`: every other registered device, which become the ones waiting for this device's queues. An upload or
   * deletion the cloud has a newer version of than the push is based on (or the same revision: it may be other content)
   * isn't applied: that version comes back as `superseded`, to be merged first. When the queues run out of room, the
   * devices that haven't pulled them get `fullSyncDue` instead and the queues start over. Returns what was committed, and
   * what was rejected for good (e.g. a note over the size limit). An undefined field is left out, as JSON would, never a
   * reason to reject.
   */
  push(me: string, ops: PushOps, recipients: string[], onProgress?: (done: number, total: number) => void): Promise<PushResult>;
}

export type Unsubscribe = () => void;

/** How often the engine pushes and acknowledges (see syncEngine.ts). */
export interface Pacing {
  pushMinInterval: number;
  ackQuiet: number;
  ackMaxWait: number;
}

export interface DeviceInfo {
  uuid: string;
  modelName: string;
  brand: string;
}

/** Which note a device has open. `at` is refreshed by a heartbeat; older than PRESENCE_TTL_MS means gone. */
export interface Presence {
  noteId: string | null;
  at: number;
}

export interface CloudDevice extends DeviceInfo {
  lastSync: string;
  /** Set by another device that couldn't queue its changes for this one (its queues ran out of room): run a full sync. */
  fullSyncDue: number | null;
  /** Devices that still have to pull this device's queued changes. */
  devicesToSync: string[];
  /** Queued note ops (add/delete/detach) this device published for others to apply. */
  pendingNotes: number;
  /** Queued category ops (add/delete) this device published for others to apply. */
  pendingCategories: number;
  presence: Presence | null;
}

/**
 * A fan-out entry carrying only a reference: the receiver fetches the note itself (the full payload didn't fit). Its `text`
 * is no ciphertext: older app versions, which don't know references, fail to decrypt it and skip the entry (without it
 * they'd store the reference as a note).
 */
export interface NoteRef {
  id: string;
  type: "text";
  text: typeof NOTE_REF_TEXT;
  rev: number;
  ref: true;
}

export const NOTE_REF_TEXT = "ref";

/** The changes one device queued for others. */
export interface ChangeSet {
  source: string;
  /** Identifies the exact queue content applied, for `ackChanges`. */
  token: string;
  notes: {
    add: Record<string, Note | NoteRef>;
    delete: Record<string, Note>;
    detach: Record<string, Note>;
  };
  categories: {
    add: Record<string, Category>;
    delete: Record<string, Category>;
  };
}

export interface DevicesSnapshot {
  devices: CloudDevice[];
  /** Changes other devices queued for this one. */
  incoming: ChangeSet[];
  /** False for a snapshot from the local cache or with this client's unconfirmed writes: never act on it (LL-027). */
  fromServer: boolean;
}

/** A deletion (or detach) recorded in the cloud, so a full sync tells it from a note the cloud lost. */
export interface Tombstone {
  rev: number;
  /** Made device-only rather than deleted. */
  detach?: boolean;
}

export type VaultRead = { status: "present"; vault: VaultDoc } | { status: "absent" | "error"; vault: null };

/** Outbox content: encrypted notes to upload, deletion/detach stubs, categories. */
export interface PushOps {
  notes: { add: Note[]; delete: Note[]; detach: Note[] };
  categories: { add: Category[]; delete: Category[] };
  /**
   * Per upload, the revision of the note this device last knew to be in the cloud (`syncedRev`; none: overwrite only
   * older versions). A deletion applies over versions up to its own revision.
   */
  bases: Record<string, number | undefined>;
}

/** Keys (note ids, category icons) per queue. */
export interface PushResult {
  committed: {
    notes: { add: string[]; delete: string[]; detach: string[] };
    categories: { add: string[]; delete: string[] };
  };
  /** The cloud's versions (encrypted) of the notes whose upload or deletion it refused for being based on an older one. */
  superseded: Note[];
  /** Note ids / category icons the backend refused for good: keep them queued, but don't retry until the next launch. */
  rejected: string[];
  /** Whether everything not rejected was committed (false: retry later). */
  complete: boolean;
}

export const PRESENCE_TTL_MS = 10 * 60 * 1000;
