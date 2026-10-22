import { defaultCategory } from "@/configs/default";
import { secureStoreGet, secureStoreRemove, secureStoreSet } from "@/libs/secureStore";
import type { Category, CloudSettings, Note } from "@/types";
import type { VaultDoc } from "@/utils/vault";

import { cloudScope, normalizeServerUrl } from "./scope";
import { jsonBytes } from "./size";
import type {
  ChangeSet,
  CloudBackend,
  CloudDevice,
  CloudFailure,
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
 *     token is the page's id and its last sequence number: acknowledging it moves this device's cursor there;
 *   - live updates by long polling (one request waits on the server until something changes): plain HTTP;
 *   - the device enrolls with the server's access key and then uses its own token (kept in secure storage), so removing
 *     it on the server revokes it. Only the server refusing the token this device holds means "removed": a token that
 *     can't be read now, or a refusal of one replaced meanwhile, is retried.
 * Every failure is answered the way the contract asks (null, false, "error"): the engine retries.
 */

const PROTOCOL = 1;
const REQUEST_TIMEOUT_MS = 20_000;
/** Reads of every note and pushes can carry megabytes. */
const LONG_REQUEST_TIMEOUT_MS = 120_000;
const HANDSHAKE_TIMEOUT_MS = 5000;
/** Secure storage that doesn't answer counts as failed: the token is then unknown, and read again. */
const STORAGE_TIMEOUT_MS = 10_000;
/** How long the server holds a long poll (it answers sooner when something changes). */
const POLL_WAIT_S = 25;
const POLL_RETRY_MIN_MS = 1000;
const POLL_RETRY_MAX_MS = 30_000;
/**
 * Per push request (the server takes up to 64 MB) and per page of every note (the server sends 8 MB at most). A request
 * that times out (a slow link) halves its size for the next ones, down to the minimum.
 */
const PUSH_CHUNK_BYTES = 4_000_000;
const NOTES_PAGE_BYTES = 8_000_000;
const MIN_CHUNK_BYTES = 256_000;
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
  /** The device token the request carried (null: none). */
  readonly token: string | null;

  constructor(status: number, code: string, message: string, token: string | null) {
    super(`${status} ${code}: ${message}`);
    this.status = status;
    this.code = code;
    this.token = token;
  }
}

/** The server gave no answer: the request didn't get through (server off, no network or VPN), or no answer in time. */
class NoAnswerError extends Error {}

/** No answer in time: the link may be slow rather than down. */
class TimeoutError extends NoAnswerError {}

/** A proxy's answer that the server behind it didn't (down, or not in time): 502-504, and Cloudflare's 52x and 530. */
const GATEWAY_FAILURES = new Set([502, 503, 504, 521, 522, 523, 524, 530]);

/** Whether a request failed because the server gave no answer, rather than an error of its own. */
const noAnswer = (e: unknown): boolean =>
  e instanceof NoAnswerError || (e instanceof ServerError && GATEWAY_FAILURES.has(e.status));

/** The scheme, the host (lower-cased, without credentials or a trailing dot) and the port (the scheme's default if none). */
function originOf(url: string): { scheme: string; host: string; port: number } | null {
  const match = /^([a-z][a-z\d+.-]*):\/\/(?:[^/?#@]*@)?(\[[^\]]*\]|[^/?#:]*)(?::(\d*))?/i.exec(url);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const port = match[3] ? Number(match[3]) : scheme === "https" ? 443 : 80;
  return { scheme, host: match[2].toLowerCase().replace(/\.$/, ""), port };
}

/** A host name every fetch hands back as written: ASCII, with a letter (an IP address or a Unicode name may be rewritten). */
const PLAIN_NAME = /^(?=.*[a-z])[a-z\d.-]+$/;

/**
 * Whether the answer came through a redirect, so it isn't the server's. On the way to another host or scheme the device's
 * token is dropped: the server's refusal would read as "this device was removed", a 404 elsewhere as a deleted note.
 *
 * With `redirect: "manual"` a browser hands back an opaque redirect and the phone (`expo/fetch`) the 3xx itself; the
 * desktop app's Rust client follows none. A browser's answer (`basic`, `cors`) may still come from https when the browser
 * upgraded the request itself (HSTS, HTTPS-Only), which keeps the token: only another fetch, one that may follow, is
 * judged by `redirected` and by where its answer came from.
 */
function redirected(res: Response, requested: string): boolean {
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return true;
  if (res.type === "basic" || res.type === "cors") return false;
  if (res.redirected) return true;
  const from = originOf(requested);
  const to = res.url ? originOf(res.url) : null;
  if (!from || !to) return false;
  if (from.scheme !== to.scheme || from.port !== to.port) return true;
  return PLAIN_NAME.test(from.host) && from.host !== to.host;
}

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

const timed = <T>(promise: Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("secure storage didn't answer")), STORAGE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

interface DeviceListener {
  onDevices: (snapshot: DevicesSnapshot) => void;
  onError: (error: unknown) => void;
  onLost?: () => void;
}

const tokenKey = (scope: string) => `serverToken_${scope}`.replace(/[^\w.-]/g, "_");

const isSame = (change: ServerChange | { same: true }): change is { same: true } => "same" in change;

/**
 * The page id names the exact content (a server restored from a backup counts its sequence numbers again, its pages have
 * other ids); the sequence number after the last "|" is what the acknowledgement sends.
 */
const toChangeSet = (change: ServerChange): ChangeSet => ({
  source: FEED_SOURCE,
  token: `${change.page}|${change.token}`,
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

/** The limits the server reports in `/v1/info` and `/v1/devices`. */
type Limits = { maxDevices?: number; maxNoteBytes?: number };

/** How often a server that doesn't report its note limit (older than 1.0.0) is asked again. */
const NOTE_LIMIT_ASK_MS = 60_000;

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
  private readonly longTimeout: number;
  private url: string | null = null;
  private key = "";
  private scope = "";
  /** This device's token, once `tokenKnown` (null: none stored). */
  private token: string | null = null;
  /** Whether `token` was read: false until then, and after a read that failed (read again on the next request). */
  private tokenKnown = false;
  private tokenLoading: Promise<void> | null = null;
  /** Token writes and removals, in order (a removal can't land after a newer token's write). */
  private tokenWrites: Promise<unknown> = Promise.resolve();
  /** A registration is replacing the token: a refusal of the old one doesn't mean "removed". */
  private registering = 0;
  private pushBytes = PUSH_CHUNK_BYTES;
  private pageBytes = NOTES_PAGE_BYTES;
  /** This device (from its registration or its subscription). */
  private me: string | null = null;
  private limit = 10;
  /** The server's MAX_NOTE_MB, once it said it (ADR-026). */
  private noteLimit: number | null = null;
  /** When the note limit was last asked for (an older server never tells it: asked again at most once a minute). */
  private noteLimitAskedAt = 0;

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

  /** `longTimeout`: tests make a slow link quick to simulate. */
  constructor(options: { fetch?: typeof fetch; storage?: TokenStorage; longTimeout?: number } = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.storage = options.storage ?? secureStorage;
    this.longTimeout = options.longTimeout ?? LONG_REQUEST_TIMEOUT_MS;
  }

  get deviceLimit(): number {
    return this.limit;
  }

  get maxNoteBytes(): number | null {
    if (this.noteLimit === null) void this.learnNoteLimit();
    return this.noteLimit;
  }

  init(settings: CloudSettings): void {
    this.generation++;
    this.stopPoll();
    this.url = normalizeServerUrl(settings.serverUrl ?? "") || null;
    this.key = (settings.serverKey ?? "").trim();
    this.scope = cloudScope(settings);
    this.token = null;
    this.tokenKnown = false;
    this.tokenLoading = null;
    this.me = null;
    this.noteLimit = null;
    this.noteLimitAskedAt = 0;
    this.version = null;
    this.lastChange = null;
    this.lastVault = null;
    this.pushBytes = PUSH_CHUNK_BYTES;
    this.pageBytes = NOTES_PAGE_BYTES;
    void this.loadToken();
    this.dropListeners();
  }

  isActive(): boolean {
    return this.url !== null;
  }

  async verify(): Promise<boolean> {
    try {
      const info = await this.request<{ server?: string; protocol?: number } & Limits>("GET", "/v1/info", {
        auth: "key",
        timeout: HANDSHAKE_TIMEOUT_MS,
      });
      if (info?.server !== "fastmemo-server" || info.protocol !== PROTOCOL) return false;
      this.takeLimits(info);
      return true;
    } catch (e) {
      console.log("handshake:", e);
      return false;
    }
  }

  /** On a connection of its own (the access key alone): the one in use is left alone. */
  async check(settings: CloudSettings): Promise<boolean> {
    const probe = new ServerBackend({ fetch: this.fetchImpl, storage: this.storage, longTimeout: this.longTimeout });
    probe.init(settings);
    try {
      return await probe.verify();
    } finally {
      await probe.dispose();
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

  async listDevices(): Promise<CloudDevice[] | CloudFailure> {
    const { generation } = this;
    try {
      const { devices, ...limits } = await this.request<{ devices: CloudDevice[] } & Limits>("GET", "/v1/devices", {
        auth: "member",
      });
      // Also here, not only in the handshake: after a restart the app doesn't handshake again. Not another server's.
      if (generation === this.generation) this.takeLimits(limits);
      return devices;
    } catch (e) {
      console.log("listDevices:", e);
      return noAnswer(e) ? "unreachable" : "error";
    }
  }

  async registerDevice({ uuid, modelName, brand }: DeviceInfo): Promise<boolean> {
    const { generation, scope } = this;
    this.registering++;
    try {
      const { token } = await this.request<{ token: string }>("POST", "/v1/devices", {
        auth: "key",
        body: { uuid, modelName: modelName || "web", brand: brand || "web" },
      });
      // Kept first: a token the next launch can't find makes the device look removed. Under the server it's for, even if
      // the connection moved on meanwhile.
      await this.writeToken(scope, token);
      if (generation !== this.generation) return false;
      this.token = token;
      this.tokenKnown = true;
      this.me = uuid;
      this.version = null;
      this.lastChange = null;
      this.ensurePolling();
      return true;
    } catch (e) {
      console.log("registerDevice:", e);
      return false;
    } finally {
      this.registering--;
    }
  }

  async unregisterDevice(uuid: string): Promise<boolean> {
    // As they were when asked: a connection re-initialised meanwhile has its own token.
    const { generation, me, token } = this;
    try {
      await this.request("DELETE", `/v1/devices/${encodeURIComponent(uuid)}`, { auth: "member" });
      if (uuid === me && token && generation === this.generation) this.dropToken(token);
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

  subscribeDevices(
    me: string,
    onDevices: (snapshot: DevicesSnapshot) => void,
    onError: (error: unknown) => void,
    onLost?: () => void
  ): () => void {
    if (!this.url) {
      onError(new Error("cloud not initialised"));
      return () => {};
    }
    this.me = me;
    const listener: DeviceListener = { onDevices, onError, onLost };
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
      if (this.refusedToken(e)) return { devices: [], incoming: [], fromServer: true };
      console.log("pullDevices:", e);
      return null;
    }
  }

  async ackChanges(_me: string, change: ChangeSet): Promise<"acked" | "changed" | "error"> {
    try {
      const seq = change.token.slice(change.token.lastIndexOf("|") + 1);
      await this.request("POST", "/v1/ack", { auth: "device", body: { token: seq } });
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
      const answer = await this.request<{ result?: string }>("POST", "/v1/vault", { auth: "member", body: vault });
      // Only the server's own word: a vault taken as created keeps its key here and hands out a recovery key.
      if (answer?.result === "created") return "created";
      console.log("createVaultExclusive: unexpected answer", answer);
      return "error";
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
      // In pages (the server bounds each by count and size). A note changed between two pages comes again in a later
      // one, newer: the later read wins.
      const notes = new Map<string, Note>();
      let after: string | null = "0";
      while (after !== null) {
        let page: { notes: Note[]; next: string | null };
        try {
          page = await this.request("GET", `/v1/notes?after=${after}&bytes=${this.pageBytes}`, {
            auth: "member",
            timeout: this.longTimeout,
          });
        } catch (e) {
          // A slow link: the same page again, smaller.
          if (!(e instanceof TimeoutError) || this.pageBytes <= MIN_CHUNK_BYTES) throw e;
          this.pageBytes = Math.max(MIN_CHUNK_BYTES, Math.floor(this.pageBytes / 2));
          continue;
        }
        for (const note of page.notes) notes.set(note.id, note);
        after = page.next;
      }
      return [...notes.values()];
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
      // Only the server's own 404: a reverse proxy's would drop an update as if the note had been deleted.
      if (e instanceof ServerError && e.status === 404 && e.code === "not_found") return null;
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
          timeout: this.longTimeout,
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
      tooLarge: [],
      complete: true,
    };
    if (!this.url) {
      result.complete = false;
      return result;
    }
    // A note over the server's limit would be refused on every try: it isn't sent (ADR-026). The limit not known (an
    // older server): the server refuses what's too big, as `rejected`.
    if (this.noteLimit === null && ops.notes.add.length > 0) await this.learnNoteLimit();
    const max = this.noteLimit;
    const notes =
      max === null
        ? ops.notes.add
        : ops.notes.add.filter((note) => {
            if (jsonBytes(note) <= max) return true;
            result.tooLarge.push(note.id);
            return false;
          });
    const entries = entriesOf({ ...ops, notes: { ...ops.notes, add: notes } });
    if (entries.length === 0) return result;

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
          timeout: this.longTimeout,
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
          // A slow link: smaller requests from the next try on (this one may have gone through: a retry is harmless).
          if (e instanceof TimeoutError) this.pushBytes = Math.max(MIN_CHUNK_BYTES, Math.floor(this.pushBytes / 2));
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

    for (const chunk of chunked(entries, PUSH_CHUNK_ENTRIES, this.pushBytes)) {
      if (!(await send(chunk))) {
        result.complete = false;
        break;
      }
    }
    return result;
  }

  // --- Internals ---

  private takeLimits({ maxDevices, maxNoteBytes }: Limits): void {
    if (typeof maxDevices === "number") this.limit = maxDevices;
    if (typeof maxNoteBytes === "number") this.noteLimit = maxNoteBytes;
  }

  /** Asks for the server's limits with the device's own credentials (the device list carries them). */
  private async learnNoteLimit(): Promise<void> {
    if (!this.url || Date.now() - this.noteLimitAskedAt < NOTE_LIMIT_ASK_MS) return;
    this.noteLimitAskedAt = Date.now();
    await this.listDevices();
  }

  private async request<T>(
    method: string,
    path: string,
    options: { auth: Auth; body?: unknown; timeout?: number; signal?: AbortSignal }
  ): Promise<T> {
    const { generation } = this;
    try {
      return await this.send<T>(method, path, options);
    } catch (e) {
      // A member call whose token the server refused (this device was removed, maybe by a leave whose answer got lost,
      // or the server lost its devices): the access key still answers, as before the device enrolled.
      const refused = e instanceof ServerError && e.status === 401 && e.code === "device_unknown" && e.token !== null;
      if (options.auth !== "member" || !refused || generation !== this.generation) throw e;
      return this.send<T>(method, path, { ...options, auth: "key" });
    }
  }

  private async send<T>(
    method: string,
    path: string,
    options: { auth: Auth; body?: unknown; timeout?: number; signal?: AbortSignal }
  ): Promise<T> {
    const { generation } = this;
    if (!this.url) throw new Error("cloud not initialised");
    if (options.auth !== "key") {
      await this.loadToken();
      // Re-initialised meanwhile: this request was for the other server (its key and token mustn't go to this one).
      if (generation !== this.generation || !this.url) throw new Error("cloud re-initialised");
      if (options.auth === "device" && !this.tokenKnown) throw new Error("the device token can't be read now");
    }
    const base = this.url;
    const token = options.auth !== "key" && this.tokenKnown ? this.token : null;
    const headers: Record<string, string> = { Accept: "application/json" };
    // The access key only when nothing else will do: enrolled, the device's own token (revocable) is all that travels.
    if (this.key && (options.auth === "key" || (options.auth === "member" && !token))) headers["X-Access-Key"] = this.key;
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeout ?? REQUEST_TIMEOUT_MS);
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener("abort", abort);
    try {
      let res: Response;
      let text: string;
      let answered = false;
      try {
        res = await this.fetchImpl(base + path, { method, headers, body, signal: controller.signal, redirect: "manual" });
        answered = true;
        if (redirected(res, base + path)) throw new Error(`${method} ${path}: redirected, not the server's answer`);
        text = await res.text();
      } catch (e) {
        if (timedOut) throw new TimeoutError(`${method} ${path}: no answer in time`);
        // fetch fails only when no answer came at all (or the caller aborted)
        if (!answered && !options.signal?.aborted) throw new NoAnswerError(`${method} ${path}: ${e}`);
        throw e;
      }
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = undefined;
      }
      // The server answers JSON or nothing: anything else (a captive portal's page) isn't its answer.
      if (res.ok && text && data === undefined) throw new Error(`${method} ${path}: not the server's answer`);
      if (!res.ok) {
        const error = (data ?? {}) as { error?: string; message?: string };
        throw new ServerError(res.status, error.error ?? "", error.message ?? text.slice(0, 200), token);
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

  /** Reads this device's token (once per connection; again after a read that failed). */
  private loadToken(): Promise<void> {
    if (this.tokenKnown) return Promise.resolve();
    if (!this.tokenLoading) {
      const { generation, scope } = this;
      this.tokenLoading = this.tokenWrites
        .then(() => timed(this.storage.get(tokenKey(scope))))
        .then(
          (token) => {
            // A registration meanwhile set a newer one.
            if (generation === this.generation && !this.tokenKnown) {
              this.token = token;
              this.tokenKnown = true;
            }
          },
          // Not "no token": that would read as removed. Unknown, and read again.
          (e) => console.log("server token:", e)
        )
        .finally(() => {
          if (generation === this.generation) this.tokenLoading = null;
        });
    }
    return this.tokenLoading;
  }

  /** Stores (or with null removes) the token of the server `scope` points to. */
  private writeToken(scope: string, token: string | null): Promise<void> {
    const key = tokenKey(scope);
    const write = this.tokenWrites.then(() => timed(token ? this.storage.set(key, token) : this.storage.remove(key)));
    this.tokenWrites = write.catch(() => {});
    return write;
  }

  /** The server no longer knows `token`: forgotten, unless it was replaced meanwhile. */
  private dropToken(token: string): void {
    if (this.token !== token) return;
    this.token = null;
    void this.writeToken(this.scope, null).catch((e) => console.log("server token:", e));
  }

  /**
   * Whether `e` is the server refusing the token this device holds (it was removed, or the server's data was reset). Not
   * a refusal of a token a registration replaced meanwhile, nor one while a registration runs.
   */
  private refusedToken(e: unknown): boolean {
    if (!(e instanceof ServerError && e.status === 401 && e.code === "device_unknown")) return false;
    return e.token !== null && e.token === this.token && this.registering === 0;
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
    const backoff = async () => {
      delay = Math.min(Math.max(delay * 2, POLL_RETRY_MIN_MS), POLL_RETRY_MAX_MS);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        this.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wake = null;
    };
    try {
      while (generation === this.generation && this.hasListeners()) {
        await this.loadToken();
        if (generation !== this.generation || !this.hasListeners()) break;
        if (!this.tokenKnown) {
          await backoff();
          continue;
        }
        if (!this.token) {
          // None stored for this server: this device isn't (or no longer) enrolled. Unless a registration is storing it.
          if (this.registering > 0) {
            await backoff();
            continue;
          }
          this.removed(null);
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
          if (this.refusedToken(e)) {
            this.removed((e as ServerError).token);
            break;
          }
          if (this.restart) continue;
          console.log("sync poll:", e);
          if (noAnswer(e)) {
            // The listeners are told; the next poll asks for the state at once, so they hear when it answers again.
            this.version = null;
            [...this.deviceListeners].forEach((listener) => listener.onLost?.());
          }
          await backoff();
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
  private removed(token: string | null): void {
    if (token) this.dropToken(token);
    [...this.deviceListeners].forEach((listener) => listener.onDevices({ devices: [], incoming: [], fromServer: true }));
  }
}
