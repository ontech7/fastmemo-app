import { defaultCategory } from "@/configs/default";
import { secureStoreGet, secureStoreRemove, secureStoreSet } from "@/libs/secureStore";
import type { Category, CloudSettings, Note } from "@/types";
import type { VaultDoc } from "@/utils/vault";

import { cloudScope, normalizeServerUrl } from "./scope";
import type {
  ChangeSet,
  CloudBackend,
  CloudDevice,
  DeviceInfo,
  DevicesSnapshot,
  Pacing,
  Presence,
  PushOps,
  PushResult,
  Tombstone,
  VaultRead,
} from "./types";
import { toVaultRead } from "./vaultRead";

/*
 * A self-hosted FastMemo server (ADR-017; the fastmemo-server repo, API /v1). The same contract as the Firestore adapter,
 * served differently:
 *   - incoming changes come from the server's change feed, a page at a time, as one change set (source "server") whose
 *     token is the page's last sequence number: acknowledging it moves this device's cursor there;
 *   - live updates by long polling (one request waits on the server until something changes): plain HTTP;
 *   - the device enrolls with the server's access key and then uses its own token (kept in secure storage), so removing
 *     it on the server revokes it.
 * Every failure is answered the way the contract asks (null, false, "error"): the engine retries.
 */

const PROTOCOL = 1;
const REQUEST_TIMEOUT_MS = 20_000;
/** Reads of every note and pushes can carry megabytes. */
const LONG_REQUEST_TIMEOUT_MS = 120_000;
const HANDSHAKE_TIMEOUT_MS = 5000;
/** How long the server holds a long poll (it answers sooner when something changes). */
const POLL_WAIT_S = 25;
const POLL_RETRY_MIN_MS = 1000;
const POLL_RETRY_MAX_MS = 30_000;
/** Per push request (the server takes up to 64 MB). */
const PUSH_CHUNK_BYTES = 4_000_000;
const PUSH_CHUNK_ENTRIES = 500;
const IMPORT_CHUNK_BYTES = 4_000_000;
const PRUNE_CHUNK = 500;
/** The feed's change sets all come from the server, not from one device. */
const FEED_SOURCE = "server";

/**
 * Pushes and acknowledgements cost the server next to nothing (unlike Firestore reads): typing shows up on the other
 * devices about twice as fast, and a device catching up gets the feed's next page sooner.
 */
const PACING: Partial<Pacing> = { pushMinInterval: 500, ackQuiet: 1000, ackMaxWait: 5000 };

type Auth = "key" | "device" | "member";
type Queue = "addNotes" | "deleteNotes" | "detachNotes" | "addCategories" | "deleteCategories";

class ServerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(`${status} ${code}: ${message}`);
    this.status = status;
    this.code = code;
  }
}

/** The server doesn't know this device's token: it was removed (or the server's data was reset). */
const isUnknownDevice = (e: unknown) => e instanceof ServerError && e.status === 401 && e.code === "device_unknown";

interface ServerChange {
  token: string;
  page: string;
  more: boolean;
  notes: ChangeSet["notes"];
  categories: ChangeSet["categories"];
}

interface ServerSnapshot {
  v: string;
  devices: CloudDevice[];
  change: ServerChange | { same: true } | null;
  vault: { status: string; vault: unknown };
}

interface Entry {
  queue: Queue;
  key: string;
  value: Note | Category;
  bytes: number;
}

/** Where this device's token is kept (secure storage; tests pass their own). */
interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const secureStorage: TokenStorage = { get: secureStoreGet, set: secureStoreSet, remove: secureStoreRemove };

interface DeviceListener {
  onDevices: (snapshot: DevicesSnapshot) => void;
  onError: (error: unknown) => void;
}

const tokenKey = (scope: string) => `serverToken_${scope}`.replace(/[^\w.-]/g, "_");

const isSame = (change: ServerChange | { same: true }): change is { same: true } => "same" in change;

const toChangeSet = (change: ServerChange): ChangeSet => ({
  source: FEED_SOURCE,
  token: change.token,
  notes: change.notes,
  categories: change.categories,
});

const toVault = (read: ServerSnapshot["vault"] | undefined): VaultRead =>
  read?.status === "present"
    ? toVaultRead(read.vault)
    : read?.status === "absent"
      ? toVaultRead(undefined)
      : { status: "error", vault: null };

const entriesOf = (ops: PushOps): Entry[] =>
  [
    ...ops.notes.add.map((value) => ({ queue: "addNotes" as const, key: value.id, value })),
    ...ops.notes.delete.map((value) => ({ queue: "deleteNotes" as const, key: value.id, value })),
    ...ops.notes.detach.map((value) => ({ queue: "detachNotes" as const, key: value.id, value })),
    ...ops.categories.add.map((value) => ({ queue: "addCategories" as const, key: value.icon, value })),
    ...ops.categories.delete.map((value) => ({ queue: "deleteCategories" as const, key: value.icon, value })),
  ].map((entry) => ({ ...entry, bytes: JSON.stringify(entry.value).length }));

/** One push request's body: these entries, and the bases of their uploads. */
const opsOf = (entries: Entry[], bases: PushOps["bases"]) => {
  const pick = (queue: Queue) => entries.filter((e) => e.queue === queue).map((e) => e.value);
  return {
    notes: { add: pick("addNotes"), delete: pick("deleteNotes"), detach: pick("detachNotes") },
    categories: { add: pick("addCategories"), delete: pick("deleteCategories") },
    bases: Object.fromEntries(
      entries.filter((e) => e.queue === "addNotes" && typeof bases[e.key] === "number").map((e) => [e.key, bases[e.key]])
    ),
  };
};

/** Splits `items` into runs of at most `maxItems` and `maxBytes` (an item larger than that goes alone). */
const chunked = <T extends { bytes: number }>(items: T[], maxItems: number, maxBytes: number): T[][] => {
  const chunks: T[][] = [];
  let chunk: T[] = [];
  let bytes = 0;
  for (const item of items) {
    if (chunk.length > 0 && (chunk.length >= maxItems || bytes + item.bytes > maxBytes)) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(item);
    bytes += item.bytes;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
};

export class ServerBackend implements CloudBackend {
  readonly pacing = PACING;

  private readonly fetchImpl: typeof fetch;
  private readonly storage: TokenStorage;
  private url: string | null = null;
  private key = "";
  private scope = "";
  private token: string | null = null;
  private tokenLoaded: Promise<void> = Promise.resolve();
  /** This device (from its registration or its subscription). */
  private me: string | null = null;
  private limit = 10;

  /** Bumped by init/dispose: a poll loop of an older generation stops. */
  private generation = 0;
  /** The generation whose poll loop is running (null: none). */
  private pollingGeneration: number | null = null;
  private poll: AbortController | null = null;
  /** The current poll was aborted on purpose (reconnect, new listener): poll again at once. */
  private restart = false;
  /** Cuts the retry wait short. */
  private wake: (() => void) | null = null;
  /** The server state the last snapshot showed (the next poll waits for a newer one). */
  private version: string | null = null;
  private lastChange: { page: string; change: ChangeSet } | null = null;
  private lastVault: string | null = null;
  private readonly deviceListeners = new Set<DeviceListener>();
  private readonly vaultListeners = new Set<(read: VaultRead) => void>();

  constructor(options: { fetch?: typeof fetch; storage?: TokenStorage } = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.storage = options.storage ?? secureStorage;
  }

  get deviceLimit(): number {
    return this.limit;
  }

  init(settings: CloudSettings): void {
    this.generation++;
    this.stopPoll();
    this.url = normalizeServerUrl(settings.serverUrl ?? "") || null;
    this.key = (settings.serverKey ?? "").trim();
    this.scope = cloudScope(settings);
    this.token = null;
    this.me = null;
    this.version = null;
    this.lastChange = null;
    this.lastVault = null;
    const scope = this.scope;
    this.tokenLoaded = this.storage
      .get(tokenKey(scope))
      .then((token) => {
        if (this.scope === scope && this.token === null) this.token = token;
      })
      .catch((e) => console.log("server token:", e));
    this.dropListeners();
  }

  isActive(): boolean {
    return this.url !== null;
  }

  async verify(): Promise<boolean> {
    try {
      const info = await this.request<{ server?: string; protocol?: number; maxDevices?: number }>("GET", "/v1/info", {
        auth: "key",
        timeout: HANDSHAKE_TIMEOUT_MS,
      });
      if (info?.server !== "fastmemo-server" || info.protocol !== PROTOCOL) return false;
      if (typeof info.maxDevices === "number") this.limit = info.maxDevices;
      return true;
    } catch (e) {
      console.log("handshake:", e);
      return false;
    }
  }

  async dispose(): Promise<boolean> {
    this.generation++;
    this.stopPoll();
    this.url = null;
    this.dropListeners();
    return true;
  }

  async reconnect(): Promise<void> {
    if (!this.poll && !this.wake) return;
    this.restart = true;
    this.poll?.abort();
    this.wake?.();
  }

  // --- Devices ---

  async listDevices(): Promise<CloudDevice[] | null> {
    try {
      return (await this.request<{ devices: CloudDevice[] }>("GET", "/v1/devices", { auth: "member" })).devices;
    } catch (e) {
      console.log("listDevices:", e);
      return null;
    }
  }

  async registerDevice({ uuid, modelName, brand }: DeviceInfo): Promise<boolean> {
    try {
      const { token } = await this.request<{ token: string }>("POST", "/v1/devices", {
        auth: "key",
        body: { uuid, modelName: modelName || "web", brand: brand || "web" },
      });
      // Kept first: a token the next launch can't find makes the device look removed.
      await this.storage.set(tokenKey(this.scope), token);
      this.token = token;
      this.me = uuid;
      this.version = null;
      this.lastChange = null;
      this.ensurePolling();
      return true;
    } catch (e) {
      console.log("registerDevice:", e);
      return false;
    }
  }

  async unregisterDevice(uuid: string): Promise<boolean> {
    try {
      await this.request("DELETE", `/v1/devices/${encodeURIComponent(uuid)}`, { auth: "member" });
      if (uuid === this.me) await this.forgetToken();
      return true;
    } catch (e) {
      console.log("unregisterDevice:", e);
      return false;
    }
  }

  /** The server's feed has no recipients to drop: every device has its own cursor. */
  async dropRecipient(): Promise<boolean> {
    return true;
  }

  async touchLastSync(uuid: string): Promise<boolean> {
    return this.call("touchLastSync", "POST", `/v1/devices/${encodeURIComponent(uuid)}/last-sync`);
  }

  async setPresence(uuid: string, presence: Presence): Promise<boolean> {
    return this.call("setPresence", "PUT", `/v1/devices/${encodeURIComponent(uuid)}/presence`, presence);
  }

  async clearFullSyncDue(me: string, due: number): Promise<boolean> {
    return this.call("clearFullSyncDue", "POST", `/v1/devices/${encodeURIComponent(me)}/full-sync-done`, { due });
  }

  subscribeDevices(me: string, onDevices: (snapshot: DevicesSnapshot) => void, onError: (error: unknown) => void): () => void {
    if (!this.url) {
      onError(new Error("cloud not initialised"));
      return () => {};
    }
    this.me = me;
    const listener: DeviceListener = { onDevices, onError };
    this.deviceListeners.add(listener);
    this.refresh();
    return () => {
      this.deviceListeners.delete(listener);
      this.stopIfIdle();
    };
  }

  async pullDevices(): Promise<DevicesSnapshot | null> {
    try {
      const snapshot = await this.request<ServerSnapshot>("GET", "/v1/sync", { auth: "device" });
      const change = snapshot.change && !isSame(snapshot.change) ? [toChangeSet(snapshot.change)] : [];
      return { devices: snapshot.devices, incoming: change, fromServer: true };
    } catch (e) {
      // Removed: an empty list tells the engine.
      if (isUnknownDevice(e)) return { devices: [], incoming: [], fromServer: true };
      console.log("pullDevices:", e);
      return null;
    }
  }

  async ackChanges(_me: string, change: ChangeSet): Promise<"acked" | "changed" | "error"> {
    try {
      await this.request("POST", "/v1/ack", { auth: "device", body: { token: change.token } });
      return "acked";
    } catch (e) {
      console.log("ackChanges:", e);
      return "error";
    }
  }

  // --- Vault ---

  async readVault(): Promise<VaultRead> {
    try {
      return toVault(await this.request<ServerSnapshot["vault"]>("GET", "/v1/vault", { auth: "member" }));
    } catch (e) {
      console.log("readVault:", e);
      return { status: "error", vault: null };
    }
  }

  async createVaultExclusive(vault: VaultDoc): Promise<"created" | "exists" | "error"> {
    try {
      await this.request("POST", "/v1/vault", { auth: "member", body: vault });
      return "created";
    } catch (e) {
      if (e instanceof ServerError && e.status === 409) return "exists";
      console.log("createVaultExclusive:", e);
      return "error";
    }
  }

  async writeVault(vault: VaultDoc): Promise<boolean> {
    return this.call("writeVault", "PUT", "/v1/vault", vault, "member");
  }

  subscribeVault(onRead: (read: VaultRead) => void): () => void {
    if (!this.url) return () => {};
    this.vaultListeners.add(onRead);
    this.refresh();
    return () => {
      this.vaultListeners.delete(onRead);
      this.stopIfIdle();
    };
  }

  // --- Data ---

  async fetchNotes(): Promise<Note[] | null> {
    try {
      return await this.request<Note[]>("GET", "/v1/notes", { auth: "member", timeout: LONG_REQUEST_TIMEOUT_MS });
    } catch (e) {
      console.log("fetchNotes:", e);
      return null;
    }
  }

  async fetchTombstones(): Promise<Record<string, Tombstone> | null> {
    try {
      return await this.request<Record<string, Tombstone>>("GET", "/v1/tombstones", { auth: "member" });
    } catch (e) {
      console.log("fetchTombstones:", e);
      return null;
    }
  }

  async pruneTombstones(ids: string[]): Promise<boolean> {
    try {
      for (let i = 0; i < ids.length; i += PRUNE_CHUNK) {
        await this.request("POST", "/v1/tombstones/prune", { auth: "member", body: { ids: ids.slice(i, i + PRUNE_CHUNK) } });
      }
      return true;
    } catch (e) {
      console.log("pruneTombstones:", e);
      return false;
    }
  }

  async fetchNote(id: string): Promise<Note | null | undefined> {
    try {
      return await this.request<Note>("GET", `/v1/notes/${encodeURIComponent(id)}`, { auth: "member" });
    } catch (e) {
      if (e instanceof ServerError && e.status === 404) return null;
      console.log("fetchNote:", e);
      return undefined;
    }
  }

  async fetchCategories(): Promise<Category[] | null> {
    try {
      return await this.request<Category[]>("GET", "/v1/categories", { auth: "member" });
    } catch (e) {
      console.log("fetchCategories:", e);
      return null;
    }
  }

  async writeNotes(notes: Note[]): Promise<boolean> {
    try {
      const sized = notes.map((note) => ({ note, bytes: JSON.stringify(note).length }));
      for (const chunk of chunked(sized, Number.MAX_SAFE_INTEGER, IMPORT_CHUNK_BYTES)) {
        await this.request("POST", "/v1/notes/import", {
          auth: "member",
          body: { notes: chunk.map((item) => item.note) },
          timeout: LONG_REQUEST_TIMEOUT_MS,
        });
      }
      return true;
    } catch (e) {
      console.log("writeNotes:", e);
      return false;
    }
  }

  async wipeNotes(): Promise<boolean> {
    return this.call("wipeNotes", "DELETE", "/v1/notes", undefined, "member");
  }

  async wipeCategories(): Promise<boolean> {
    return this.call("wipeCategories", "POST", "/v1/categories/reset", { category: defaultCategory }, "member");
  }

  async push(
    _me: string,
    ops: PushOps,
    _recipients: string[],
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
    if (!this.url) {
      result.complete = false;
      return result;
    }

    let done = 0;
    const progressed = (n: number) => {
      done += n;
      onProgress?.(done, entries.length);
    };
    /** False: retry later. A request the server refuses for its size is split until the culprit is alone, then rejected. */
    const send = async (chunk: Entry[]): Promise<boolean> => {
      try {
        const reply = await this.request<PushResult>("POST", "/v1/push", {
          auth: "device",
          body: opsOf(chunk, ops.bases),
          timeout: LONG_REQUEST_TIMEOUT_MS,
        });
        const { committed } = result;
        committed.notes.add.push(...reply.committed.notes.add);
        committed.notes.delete.push(...reply.committed.notes.delete);
        committed.notes.detach.push(...reply.committed.notes.detach);
        committed.categories.add.push(...reply.committed.categories.add);
        committed.categories.delete.push(...reply.committed.categories.delete);
        result.superseded.push(...(reply.superseded as Note[]));
        result.rejected.push(...reply.rejected);
        progressed(chunk.length);
        return true;
      } catch (e) {
        if (!(e instanceof ServerError && e.status === 413)) {
          console.log("push:", e);
          return false;
        }
        if (chunk.length > 1) {
          const half = Math.ceil(chunk.length / 2);
          return (await send(chunk.slice(0, half))) && (await send(chunk.slice(half)));
        }
        console.log(`push: "${chunk[0].key}" rejected:`, e);
        result.rejected.push(`${chunk[0].queue}:${chunk[0].key}`);
        progressed(1);
        return true;
      }
    };

    for (const chunk of chunked(entries, PUSH_CHUNK_ENTRIES, PUSH_CHUNK_BYTES)) {
      if (!(await send(chunk))) {
        result.complete = false;
        break;
      }
    }
    return result;
  }

  // --- Internals ---

  private async request<T>(
    method: string,
    path: string,
    options: { auth: Auth; body?: unknown; timeout?: number; signal?: AbortSignal }
  ): Promise<T> {
    const base = this.url;
    if (!base) throw new Error("cloud not initialised");
    if (options.auth !== "key") await this.tokenLoaded;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.auth !== "device" && this.key) headers["X-Access-Key"] = this.key;
    if (options.auth !== "key" && this.token) headers.Authorization = `Bearer ${this.token}`;
    let body: string | undefined;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout ?? REQUEST_TIMEOUT_MS);
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener("abort", abort);
    try {
      const res = await this.fetchImpl(base + path, { method, headers, body, signal: controller.signal });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = undefined;
      }
      if (!res.ok) {
        const error = (data ?? {}) as { error?: string; message?: string };
        throw new ServerError(res.status, error.error ?? "", error.message ?? text.slice(0, 200));
      }
      return data as T;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  /** A request whose outcome is only "done or not". */
  private async call(name: string, method: string, path: string, body?: unknown, auth: Auth = "device"): Promise<boolean> {
    try {
      await this.request(method, path, { auth, body });
      return true;
    } catch (e) {
      console.log(`${name}:`, e);
      return false;
    }
  }

  private async forgetToken(): Promise<void> {
    this.token = null;
    await this.storage.remove(tokenKey(this.scope)).catch(() => {});
  }

  private hasListeners(): boolean {
    return this.deviceListeners.size > 0 || this.vaultListeners.size > 0;
  }

  /** A new listener: like a Firestore listener, it gets the current state now (the running poll restarts without waiting). */
  private refresh(): void {
    this.version = null;
    this.lastVault = null;
    if (this.pollingGeneration === this.generation) void this.reconnect();
    else this.ensurePolling();
  }

  private ensurePolling(): void {
    if (this.pollingGeneration === this.generation || !this.url || !this.hasListeners()) return;
    this.pollingGeneration = this.generation;
    void this.pollLoop(this.generation);
  }

  private stopIfIdle(): void {
    if (!this.hasListeners()) this.stopPoll();
  }

  private stopPoll(): void {
    this.poll?.abort();
    this.wake?.();
  }

  /** Listeners on a re-initialised or disposed connection are told, and subscribe again (like the Firestore adapter's). */
  private dropListeners(): void {
    const listeners = [...this.deviceListeners];
    this.deviceListeners.clear();
    this.vaultListeners.clear();
    listeners.forEach((listener) => listener.onError(new Error("cloud re-initialised")));
  }

  private async pollLoop(generation: number): Promise<void> {
    let delay = 0;
    try {
      while (generation === this.generation && this.hasListeners()) {
        await this.tokenLoaded;
        if (generation !== this.generation) break;
        if (!this.token) {
          this.removed();
          break;
        }
        const query = new URLSearchParams({ wait: String(POLL_WAIT_S) });
        if (this.version) query.set("v", this.version);
        if (this.lastChange) query.set("p", this.lastChange.page);
        const controller = new AbortController();
        this.poll = controller;
        this.restart = false;
        try {
          const snapshot = await this.request<ServerSnapshot>("GET", `/v1/sync?${query}`, {
            auth: "device",
            timeout: (POLL_WAIT_S + 20) * 1000,
            signal: controller.signal,
          });
          if (generation !== this.generation) break;
          delay = 0;
          this.deliver(snapshot);
        } catch (e) {
          if (generation !== this.generation || !this.hasListeners()) break;
          if (isUnknownDevice(e)) {
            this.removed();
            break;
          }
          if (this.restart) continue;
          console.log("sync poll:", e);
          delay = Math.min(Math.max(delay * 2, POLL_RETRY_MIN_MS), POLL_RETRY_MAX_MS);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, delay);
            this.wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          this.wake = null;
        } finally {
          if (this.poll === controller) this.poll = null;
        }
      }
    } finally {
      if (this.pollingGeneration === generation) this.pollingGeneration = null;
    }
  }

  private deliver(snapshot: ServerSnapshot): void {
    const page = snapshot.change;
    let incoming: ChangeSet[] = [];
    if (page === null) {
      this.lastChange = null;
    } else if (isSame(page)) {
      // The page it means was dropped meanwhile (a registration): ask for it whole, at once.
      if (!this.lastChange) {
        this.version = null;
        return;
      }
      incoming = [this.lastChange.change];
    } else {
      const change = toChangeSet(page);
      this.lastChange = { page: page.page, change };
      incoming = [change];
    }
    this.version = snapshot.v;
    const devices = snapshot.devices;
    [...this.deviceListeners].forEach((listener) => listener.onDevices({ devices, incoming, fromServer: true }));

    const vault = JSON.stringify(snapshot.vault ?? null);
    if (vault !== this.lastVault) {
      this.lastVault = vault;
      const read = toVault(snapshot.vault);
      [...this.vaultListeners].forEach((listener) => listener(read));
    }
  }

  /** The server doesn't know this device anymore: an empty device list tells the engine (it disconnects). */
  private removed(): void {
    void this.forgetToken();
    [...this.deviceListeners].forEach((listener) => listener.onDevices({ devices: [], incoming: [], fromServer: true }));
  }
}
