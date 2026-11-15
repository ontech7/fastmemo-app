// Sync engine test (ADR-016): the merge rules on their own, then several devices syncing through an in-memory cloud
// with the same contract as the Firestore adapter (guarded pushes, transactional acks, shared fan-out queues).
// Run: node scripts/sync.test.mjs
// It bundles the real notes/categories slices and the engine with esbuild (native-only imports stubbed).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "sync.bundle.mjs");

// Modules the slices import that need a device (or the cloud): replaced by minimal stand-ins.
const STUBS = {
  "@/libs/cloud": `export const only_if_cloudConnected = (cb) => cb(); export const isCloudConnected = () => true; export const cloud = null;`,
  // The app's note store, which the wipe thunk uses (ADR-018).
  "@/libs/storage/notes": `export const noteStore = null; export const notesNeedSorting = () => false;`,
  // The history of versions (the wipe thunk wipes it; the store keeps them on a device).
  "@/libs/history": `export const wipeHistory = async () => {}; export const keepVersion = (note, reason) => { globalThis.__kept?.push({ note: JSON.parse(JSON.stringify(note)), reason }); }; export const readVersion = async (noteId, versionId) => globalThis.__versions?.[noteId + ":" + versionId] ?? null;`,
  // What a restore tells the open editor, the user's webhook and the error trail (recorded by the restore's cases).
  "@/libs/cloud/sync": `export const notifyNoteChanged = (id) => { globalThis.__notified?.push(id); };`,
  "@/utils/webhook": `export const webhook = (config, body) => { globalThis.__webhooks?.push(body); };`,
  "@/libs/diagnostics": `export const addTrail = () => {};`,
  "@/slicers/settingsSlice": `export const selectorWebhook_updateNote = () => ({ url: "" });`,
  "@/utils/date": `export const formatDateTime = () => "D";`,
  // A test locks the vault with globalThis.__vaultLocked.
  "@/libs/vaultSession": `export const isVaultUnlocked = () => globalThis.__vaultLocked !== true; export const getDEK = () => "k1";`,
  // Counts what the slice encrypts (the upload queue holds markers: nothing, ADR-036).
  "@/utils/crypt": `export const CryptNote = { encrypt: (note) => { globalThis.__sliceEncrypts = (globalThis.__sliceEncrypts ?? 0) + 1; return { ...note, sealed: "outbox" }; } };`,
  "@/configs/default": `export const defaultCategory = { order: 0, name: "All", icon: "none", index: true, selected: true };`,
  "@/constants/icons": `export const CATEGORY_MAP = {};`,
};

const resolver = {
  name: "fastmemo-test-resolver",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) => {
      if (STUBS[args.path] !== undefined) return { path: args.path, namespace: "stub" };
      return null;
    });
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

await build({
  stdin: {
    contents: `
      export { configureStore } from "@reduxjs/toolkit";
      export * as notes from "@/slicers/notesSlice";
      export { default as notesReducer } from "@/slicers/notesSlice";
      export * as categories from "@/slicers/categoriesSlice";
      export { default as categoriesReducer } from "@/slicers/categoriesSlice";
      export { createPlanner, reconcileCategories } from "@/libs/cloud/merge";
      export { noteRev, nextRev, adoptLegacySyncState, fromOlderVersion, forUpload } from "@/libs/cloud/revision";
      export { contentToken } from "@/libs/cloud/token";
      export { SyncEngine } from "@/libs/cloud/syncEngine";
      export { withReminder } from "@/libs/reminders/plan";
      export { copyOfNote } from "@/libs/noteCopy";
      export { restoreVersion } from "@/slicers/thunks/restoreVersion";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
  plugins: [resolver],
  define: { "process.env.EXPO_PUBLIC_ENV": '"TEST"', "process.env.EXPO_PUBLIC_API_URL": '""' },
});

// The real note decryption, as released versions run it (for the reference-entry check).
const cryptOut = join(os.tmpdir(), "sync.crypt.bundle.mjs");
await build({
  entryPoints: [join(src, "utils", "crypt.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: cryptOut,
  logLevel: "error",
  alias: {
    "@": src,
    "expo-crypto": join(__dirname, "_expo-crypto-stub.js"),
    "expo-secure-store": join(__dirname, "_expo-secure-store-stub.js"),
  },
});

const M = await import(pathToFileURL(out).href);
const Crypt = await import(pathToFileURL(cryptOut).href);
const { notes: N, categories: C } = M;

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
};

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits until `cond()` holds, or `ms` passed. */
const until = async (cond, ms = 4000) => {
  const deadline = Date.now() + ms;
  while (!cond() && Date.now() < deadline) await sleep(20);
  return cond();
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Merge rules                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nmerge");

const note = (id, rev, extra = {}) => ({
  id,
  type: "text",
  title: id,
  text: `v${rev}`,
  category: { order: 0, name: "All", icon: "none", index: true, selected: true },
  date: "",
  createdAt: 1,
  updatedAt: rev,
  rev,
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
  ...extra,
});
/** As an older app version left it: no revision, only `updatedAt`. */
const legacy = (id, updatedAt, extra = {}) => {
  const { rev: _rev, ...n } = note(id, updatedAt, extra);
  return n;
};
const local = (items = [], trash = [], extra = {}) => ({
  items,
  trash,
  purged: {},
  pendingUploads: {},
  pendingDeletes: {},
  ...extra,
});

{
  const p = M.createPlanner(local([note("a", 100, { syncedRev: 100 })]), "(c)");
  p.add(note("a", 200));
  const plan = p.plan();
  ok(
    "newer version replaces an unchanged note",
    plan.put.length === 1 && plan.put[0].text === "v200" && plan.conflicts.length === 0
  );
  ok("...and records it as synced", plan.put[0].syncedRev === 200);
}
{
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  p.add(note("a", 200));
  ok("older version (stale replay) is ignored", p.plan().put.length === 0);
}
{
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 100 })]), "(c)");
  p.add(note("a", 200));
  const plan = p.plan();
  ok(
    "both changed, local newer: local kept, remote becomes a copy",
    plan.put.length === 1 && plan.put[0].id === "a~200" && plan.put[0].title === "a (c)" && plan.synced.a === 200,
    plan
  );
  ok("...and the copy is uploaded", plan.upload.includes("a~200"));
}
{
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 100 })]), "(c)");
  p.add(note("a", 400));
  const plan = p.plan();
  const ids = plan.put.map((n) => n.id).sort();
  ok("both changed, remote newer: remote takes the id, local becomes a copy", ids.join() === "a,a~300", ids);
  ok("...local upload dropped, copy queued", plan.dropUploads.includes("a") && plan.upload.includes("a~300"));
}
{
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 100 }), note("a~400", 400)]), "(c)");
  p.add(note("a", 400));
  ok("a conflict copy is made once (deterministic id)", p.plan().put.filter((n) => n.id.startsWith("a~")).length === 1);
}
{
  const p = M.createPlanner(local([], [note("a", 300, { deletedAt: 300 })]), "(c)");
  p.add(note("a", 200));
  const stale = p.plan();
  const q = M.createPlanner(local([], [note("a", 300, { deletedAt: 300 })], { pendingDeletes: { a: {} } }), "(c)");
  q.add(note("a", 400));
  const newer = q.plan();
  ok("an older edit doesn't bring a trashed note back", stale.put.length === 0);
  ok("a newer edit restores a trashed note", newer.put.length === 1 && newer.dropDeletes.includes("a"));
}
{
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  p.remove({ id: "a", rev: 200, deletedAt: 200 });
  const q = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  q.remove({ id: "a", rev: 400, deletedAt: 400 });
  ok("an older deletion doesn't trash a newer note", p.plan().trash.length === 0);
  ok("a newer deletion trashes the note", q.plan().trash.length === 1 && q.plan().trash[0].deletedAt === 400);
}
{
  const p = M.createPlanner(local([], [], { purged: { a: 500 } }), "(c)");
  p.add(note("a", 400));
  const q = M.createPlanner(local([], [], { purged: { a: 500 } }), "(c)");
  q.add(note("a", 600));
  ok("a purged note isn't resurrected by an older copy", p.plan().put.length === 0);
  ok("...but a newer edit (made after) comes in", q.plan().put.length === 1);
}
{
  const p = M.createPlanner(local([note("a", 300, { local: true })]), "(c)");
  p.add(note("a", 400));
  p.remove({ id: "a", rev: 500 });
  ok("an offline (device-only) note ignores incoming changes", p.plan().put.length === 0 && p.plan().trash.length === 0);
}
{
  // Synced before revisions existed (no syncedRev): plain last-writer-wins, unless an upload is waiting.
  const p = M.createPlanner(local([legacy("a", 300)]), "(c)");
  p.add(note("a", 400));
  const q = M.createPlanner(local([legacy("a", 300)], [], { pendingUploads: { a: {} } }), "(c)");
  q.add(note("a", 400));
  ok("legacy note: newer remote replaces it", p.plan().put.length === 1 && p.plan().conflicts.length === 0);
  ok("legacy note with a waiting upload: both kept", q.plan().conflicts.length === 1);
}
{
  // An older app version keeps the revision of a note a newer one wrote (it stores what it receives), but no syncedRev.
  const received = note("a", 300, { updatedAt: 299 });
  const editedThere = note("b", 300, { updatedAt: 450, text: "old app edit" });
  const waiting = note("c", 300, { updatedAt: 299 });
  const state = {
    items: [
      received,
      editedThere,
      waiting,
      legacy("d", 200),
      note("e", 300, { local: true }),
      note("f", 500, { syncedRev: 400 }),
    ],
    cloud: { items: { add: { c: {} } } },
  };
  const adopted = M.adoptLegacySyncState(state, 1000).items;
  const byId = Object.fromEntries(adopted.map((n) => [n.id, n]));
  ok("taking over an older version's notes: a received revision counts as synced", byId.a.syncedRev === 300);
  ok("...also under a later edit made there (still a change)", byId.b.syncedRev === 300 && M.noteRev(byId.b) > 300);
  ok(
    "...one with an upload waiting is a change on top of it: stamped with a revision of its own",
    byId.c.syncedRev === 300 && byId.c.rev === 1000
  );
  ok(
    "...but not one without a revision, a device-only one, or one already synced",
    byId.d.syncedRev === undefined && byId.e.syncedRev === undefined && byId.f.syncedRev === 400
  );
  const without = ({ syncedRev: _syncedRev, rev: _rev, ...rest }) => JSON.stringify(rest);
  ok(
    "...and nothing else changes",
    adopted.every((n, i) => without(n) === without(state.items[i]) && (n.id === "c" || n.rev === state.items[i].rev))
  );
  ok("...nor the state it was given", state.items[0].syncedRev === undefined && state.items[2].rev === 300);
  ok(
    "a state with nothing to take over is returned as it is",
    M.adoptLegacySyncState({ items: [legacy("d", 200)] }).items[0].syncedRev === undefined
  );
  const older = { ...state, _persist: { version: -1, rehydrated: true } };
  ok("taken over only from an older version's state", M.fromOlderVersion(older).items[0].syncedRev === 300);
  ok(
    "...not from this version's, one with no version (rebuilt), or none",
    M.fromOlderVersion({ ...older, _persist: { version: 1, rehydrated: true } }).items[0].syncedRev === undefined &&
      M.fromOlderVersion(state).items[0].syncedRev === undefined &&
      M.fromOlderVersion(undefined) === undefined
  );

  const p = M.createPlanner(local([byId.a]), "(c)");
  p.add(note("a", 400));
  ok(
    "a newer version then replaces it, without a conflict copy",
    p.plan().put.length === 1 && p.plan().conflicts.length === 0,
    p.plan()
  );
  const q = M.createPlanner(local([byId.b]), "(c)");
  q.add(note("a", 500, { id: "b" }));
  ok("one edited on the older version: both kept", q.plan().conflicts.length === 1);
  const r = M.createPlanner(local([received]), "(c)");
  r.add(note("a", 400));
  ok("(without taking it over, it was taken for a change: the copy this fixes)", r.plan().conflicts.length === 1);
}
{
  // An older app version only bumps updatedAt (its rev is the one it received).
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  p.add(note("a", 300, { updatedAt: 450, text: "old app edit" }));
  ok("an older app's edit (updatedAt only) counts as newer", p.plan().put[0]?.text === "old app edit");
}
{
  const p = M.createPlanner(
    local([note("a", 300, { syncedRev: 300 }), note("b", 100, { syncedRev: 100 })], [note("t", 50, { deletedAt: 50 })]),
    "(c)"
  );
  p.reconcile([note("a", 300), note("c", 10)], { a: 300, c: 10, t: 40 }, {});
  const plan = p.plan();
  ok(
    "reconcile: a note missing from the cloud is uploaded again, never dropped",
    plan.upload.includes("b") && plan.trash.length === 0
  );
  ok(
    "reconcile: a cloud-only note comes in",
    plan.put.some((n) => n.id === "c")
  );
  ok("reconcile: a local deletion newer than the cloud copy is sent again", plan.sendDeletes.includes("t"));
}
{
  const same = M.createPlanner(local([note("a", 300, { syncedRev: 200 })], [], { pendingUploads: { a: {} } }), "(c)");
  same.add(note("a", 300));
  const plan = same.plan();
  ok(
    "same revision, same content: marked synced, its waiting upload dropped (it's in the cloud)",
    plan.put.length === 0 && plan.synced.a === 300 && plan.dropUploads.includes("a")
  );
}
{
  // An older app version toggles a flag without a new revision.
  const p = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  p.add(note("a", 300, { important: true }));
  ok("same revision, other content: the incoming (cloud) version is taken", p.plan().put[0]?.important === true);
  ok("...with no conflict copy when nothing changed here", p.plan().conflicts.length === 0);
  const q = M.createPlanner(local([note("a", 300, { syncedRev: 200, text: "mine" })]), "(c)");
  q.add(note("a", 300, { text: "theirs" }));
  const plan = q.plan();
  ok(
    "same revision, both changed: both kept, the cloud's under the id",
    plan.put.find((n) => n.id === "a")?.text === "theirs" && plan.put.some((n) => n.text === "mine" && n.id !== "a")
  );
  const r = M.createPlanner(local([note("a", 300, { syncedRev: 300 })]), "(c)");
  ok("a reference with the revision this device has isn't fetched", r.offer("a", 300, false) === false);
}
{
  // Permanently deleted here (still queued), edited elsewhere later: the edit comes back, the deletion is outdated.
  const p = M.createPlanner(local([], [], { purged: { a: 300 }, pendingDeletes: { a: {} } }), "(c)");
  p.add(note("a", 400));
  ok("a deletion still queued for a note that comes back is dropped", p.plan().dropDeletes.includes("a"));
}
{
  // An older app version trashes (its stub has no revision: updatedAt), then restores the same version.
  const p = M.createPlanner(local([legacy("a", 300)]), "(c)");
  p.remove({ id: "a", type: "text", updatedAt: 300 });
  const trashed = p.plan().trash;
  const q = M.createPlanner(local([], trashed), "(c)");
  q.add(legacy("a", 300));
  ok("an older app's restore (same version) brings the note back", q.plan().put.length === 1);
  const r = M.createPlanner(local([], trashed), "(c)");
  r.reconcile([legacy("a", 300)], { a: 300 }, {});
  ok("...and a full sync doesn't delete it again", !r.plan().sendDeletes.includes("a") && r.plan().put.length === 1);
  const t = M.createPlanner(local([], [note("a", 300, { deletedAt: 300 })]), "(c)");
  t.add(note("a", 300));
  ok("a replay of the version this app trashed stays in the trash", t.plan().put.length === 0);
}
{
  const p = M.createPlanner(
    local([note("gone", 300, { syncedRev: 300 }), note("kept", 500, { syncedRev: 300 }), note("det", 300, { syncedRev: 300 })]),
    "(c)"
  );
  p.reconcile([], {}, { gone: { rev: 400 }, kept: { rev: 400 }, det: { rev: 400, detach: true } });
  const plan = p.plan();
  ok(
    "reconcile: a note deleted elsewhere (tombstone) is trashed, not uploaded again",
    plan.trash.some((n) => n.id === "gone") && !plan.upload.includes("gone")
  );
  ok("reconcile: one changed here after the deletion is uploaded", plan.upload.includes("kept"));
  ok("reconcile: one made device-only elsewhere is detached here", plan.detach.includes("det") && !plan.upload.includes("det"));
}
{
  // Stamped here but never synced (e.g. edited while sync was off): a change the cloud doesn't have.
  const p = M.createPlanner(local([note("a", 300)]), "(c)");
  p.add(note("a", 400));
  ok("a never-synced change and a newer cloud version: both kept", p.plan().conflicts.length === 1);
}
{
  const cats = M.reconcileCategories(
    [
      { icon: "none", index: true, order: 0, name: "All", selected: false },
      { icon: "work", index: false, order: 1, name: "Work", selected: true },
      { icon: "home", index: false, order: 2, name: "Home", selected: false },
    ],
    { add: { home: {} }, delete: {} },
    [
      { icon: "work", index: false, order: 3, name: "Job", selected: false },
      { icon: "home", index: false, order: 2, name: "Casa", selected: false },
      { icon: "gym", index: false, order: 4, name: "Gym", selected: true },
    ]
  );
  const byIcon = Object.fromEntries(cats.items.map((c) => [c.icon, c]));
  ok(
    "categories: cloud wins, selection stays local",
    byIcon.work.name === "Job" && byIcon.work.selected === true && byIcon.gym.selected === false
  );
  ok("categories: a waiting local change wins", byIcon.home.name === "Home");
}

{
  // Released versions don't know reference entries: their decryption must reject one, or they'd store it as a note.
  const ref = { id: "a", type: "text", text: "ref", rev: 100, ref: true };
  ok("a reference entry fails an older app's decryption (skipped there)", Crypt.tryDecryptNote(ref, "any-dek") === null);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* In-memory cloud with the Firestore adapter's semantics                                                            */
/* ------------------------------------------------------------------------------------------------------------------ */

const QUEUES = ["addNotes", "deleteNotes", "detachNotes", "addCategories", "deleteCategories"];
const NOTE_QUEUES = QUEUES.slice(0, 3);

class Cloud {
  notes = new Map();
  categories = new Map();
  devices = new Map();
  tombstones = new Map();
  vault = { key: "k1" };
  backends = new Set();

  token(dev) {
    return M.contentToken(QUEUES.map((q) => dev[q] ?? null));
  }

  snapshot(me) {
    const devices = [...this.devices.values()].map((d) => ({
      uuid: d.uuid,
      modelName: d.uuid,
      brand: "test",
      lastSync: d.lastSync,
      fullSyncDue: d.fullSyncDue ?? null,
      devicesToSync: [...d.devicesToSync],
      pendingNotes: 0,
      pendingCategories: 0,
      presence: d.presence ?? null,
    }));
    const incoming = [...this.devices.values()]
      .filter((d) => d.uuid !== me && d.devicesToSync.includes(me))
      .map((d) => ({
        source: d.uuid,
        token: this.token(d),
        notes: { add: clone(d.addNotes ?? {}), delete: clone(d.deleteNotes ?? {}), detach: clone(d.detachNotes ?? {}) },
        categories: { add: clone(d.addCategories ?? {}), delete: clone(d.deleteCategories ?? {}) },
      }));
    return { devices, incoming, fromServer: true };
  }

  changed() {
    for (const backend of this.backends) backend.emit();
  }
}

/** One device's connection: goes offline on demand; offline it fails like Firestore's server reads/transactions. */
class FakeBackend {
  online = true;
  listener = null;
  vaultListener = null;
  /** Ids whose upload fails for good (like a note over Firestore's 1 MiB limit). */
  poison = new Set();
  /** The largest note (as JSON) this cloud takes: bigger ones aren't sent (`tooLarge`). Null: no limit known. */
  maxNoteBytes = null;
  /** How many entries the queues hold (the size and index budgets): past that they start over (see planFanout). */
  maxQueuedEntries = Infinity;
  pushes = 0;
  /** Acknowledgements that cleared something. */
  acks = 0;
  /** Pushes that wrote this device's doc (each wakes every device's listener). */
  deviceWrites = 0;

  constructor(cloud, me) {
    this.cloud = cloud;
    this.me = me;
    cloud.backends.add(this);
  }

  emit() {
    if (!this.online || !this.listener) return;
    const snapshot = this.cloud.snapshot(this.me);
    const listener = this.listener;
    setTimeout(() => listener.onSnapshot(snapshot), 0);
  }

  init() {}
  isActive() {
    return true;
  }
  async verify() {
    return this.online;
  }
  async dispose() {
    return true;
  }
  async reconnect() {
    this.emit();
  }

  async listDevices() {
    return this.online ? this.cloud.snapshot(this.me).devices : "unreachable";
  }
  async registerDevice({ uuid }) {
    this.cloud.devices.set(uuid, {
      uuid,
      lastSync: `${Date.now()}`,
      devicesToSync: [],
      ...Object.fromEntries(QUEUES.map((q) => [q, {}])),
    });
    this.cloud.changed();
    return true;
  }
  async unregisterDevice(uuid) {
    this.cloud.devices.delete(uuid);
    this.cloud.changed();
    return true;
  }
  async dropRecipient(uuid) {
    for (const d of this.cloud.devices.values()) d.devicesToSync = d.devicesToSync.filter((r) => r !== uuid);
    this.cloud.changed();
    return true;
  }
  async touchLastSync(uuid) {
    const d = this.cloud.devices.get(uuid);
    if (!this.online || !d) return false;
    d.lastSync = `${Date.now()}`;
    this.cloud.changed();
    return true;
  }
  async setPresence(uuid, presence) {
    const d = this.cloud.devices.get(uuid);
    if (!this.online || !d) return false;
    d.presence = presence;
    this.cloud.changed();
    return true;
  }
  async clearFullSyncDue(me, due) {
    if (!this.online) return false;
    const d = this.cloud.devices.get(me);
    if (d && d.fullSyncDue === due) delete d.fullSyncDue;
    this.cloud.changed();
    return true;
  }
  subscribeDevices(me, onSnapshot, onError, onLost) {
    this.listener = { onSnapshot, onError, onLost };
    this.emit();
    return () => {
      this.listener = null;
    };
  }
  async pullDevices(me) {
    return this.online ? this.cloud.snapshot(me) : null;
  }
  async ackChanges(me, change) {
    if (!this.online) return "error";
    const d = this.cloud.devices.get(change.source);
    if (!d || !d.devicesToSync.includes(me)) return "acked";
    if (this.cloud.token(d) !== change.token) return "changed";
    d.devicesToSync = d.devicesToSync.filter((r) => r !== me);
    if (d.devicesToSync.length === 0) for (const q of QUEUES) d[q] = {};
    this.acks++;
    this.cloud.changed();
    return "acked";
  }

  async readVault() {
    return this.online ? { status: "present", vault: clone(this.cloud.vault) } : { status: "error", vault: null };
  }
  async createVaultExclusive() {
    return "exists";
  }
  async writeVault(vault) {
    this.cloud.vault = clone(vault);
    return true;
  }
  subscribeVault(onRead) {
    this.vaultListener = onRead;
    setTimeout(() => this.online && onRead({ status: "present", vault: clone(this.cloud.vault) }), 0);
    return () => {
      this.vaultListener = null;
    };
  }

  async fetchNotes() {
    return this.online ? [...this.cloud.notes.values()].map(clone) : null;
  }
  async fetchTombstones() {
    return this.online ? Object.fromEntries([...this.cloud.tombstones].map(([id, t]) => [id, clone(t)])) : null;
  }
  async pruneTombstones(ids) {
    ids.forEach((id) => this.cloud.tombstones.delete(id));
    return this.online;
  }
  async fetchNote(id) {
    if (!this.online) return undefined;
    return clone(this.cloud.notes.get(id)) ?? null;
  }
  async fetchCategories() {
    return this.online ? [...this.cloud.categories.values()].map(clone) : null;
  }
  async writeNotes(notes) {
    notes.forEach((n) => this.cloud.notes.set(n.id, clone(n)));
    return true;
  }
  async wipeNotes() {
    this.cloud.notes.clear();
    this.cloud.tombstones.clear();
    return true;
  }
  async wipeCategories() {
    this.cloud.categories.clear();
    return true;
  }

  async push(me, ops, recipients, onProgress) {
    this.pushes++;
    const result = {
      committed: { notes: { add: [], delete: [], detach: [] }, categories: { add: [], delete: [] } },
      superseded: [],
      rejected: [],
      tooLarge: [],
      complete: true,
    };
    if (!this.online) return { ...result, complete: false };
    const device = this.cloud.devices.get(me);
    if (!device) return { ...result, complete: false };
    if (this.maxNoteBytes !== null) {
      const fits = (note) => JSON.stringify(note).length <= this.maxNoteBytes;
      result.tooLarge = ops.notes.add.filter((note) => !fits(note)).map((note) => note.id);
      ops = { ...ops, notes: { ...ops.notes, add: ops.notes.add.filter(fits) } };
    }

    const entries = [
      ...ops.notes.add.map((v) => ["addNotes", v.id, v]),
      ...ops.notes.delete.map((v) => ["deleteNotes", v.id, v]),
      ...ops.notes.detach.map((v) => ["detachNotes", v.id, v]),
      ...ops.categories.add.map((v) => ["addCategories", v.icon, v]),
      ...ops.categories.delete.map((v) => ["deleteCategories", v.icon, v]),
    ];
    const record = (queue, key) => {
      const [group, kind] = queue.endsWith("Notes") ? ["notes", queue.slice(0, -5)] : ["categories", queue.slice(0, -10)];
      result.committed[group][kind].push(key);
    };

    const applied = [];
    for (const [queue, key, value] of entries) {
      if (this.poison.has(key)) {
        result.rejected.push(`${queue}:${key}`);
        continue;
      }
      const cloudNote = this.cloud.notes.get(key);
      if (queue === "addNotes" && cloudNote) {
        const cloudRev = M.noteRev(cloudNote);
        const rev = M.noteRev(value);
        if (cloudRev === rev || cloudRev > (ops.bases[key] ?? rev)) {
          result.superseded.push(clone(cloudNote));
          continue;
        }
      }
      if (queue === "deleteNotes" && cloudNote && M.noteRev(cloudNote) > M.noteRev(value)) {
        result.superseded.push(clone(cloudNote));
        continue;
      }
      applied.push([queue, key, value]);
    }
    onProgress?.(entries.length, entries.length);
    if (applied.length === 0) return result;

    for (const [queue, key, value] of applied) {
      if (queue === "addNotes") this.cloud.notes.set(key, clone(value));
      else if (NOTE_QUEUES.includes(queue)) this.cloud.notes.delete(key);
      else if (queue === "addCategories") this.cloud.categories.set(key, clone(value));
      else this.cloud.categories.delete(key);
      if (queue === "deleteNotes" || queue === "detachNotes") {
        this.cloud.tombstones.set(key, { rev: M.noteRev(value), ...(queue === "detachNotes" && { detach: true }) });
      }
      record(queue, key);
    }

    // Fan-out, as planFanout does it.
    const flag = (ids) =>
      ids.forEach((id) => {
        const d = this.cloud.devices.get(id);
        if (d) d.fullSyncDue = Date.now();
      });
    const place = (queues) => {
      for (const [queue, key, value] of applied) {
        const group = NOTE_QUEUES.includes(queue) ? NOTE_QUEUES : QUEUES.slice(3);
        group.forEach((q) => delete queues[q][key]);
        queues[queue][key] = clone(value);
      }
      return QUEUES.reduce((n, q) => n + Object.keys(queues[q]).length, 0) <= this.maxQueuedEntries ? queues : null;
    };
    const empty = () => Object.fromEntries(QUEUES.map((q) => [q, {}]));
    if (recipients.length === 0) {
      Object.assign(device, empty());
      device.devicesToSync = [];
    } else {
      let queues = place(Object.fromEntries(QUEUES.map((q) => [q, { ...device[q] }])));
      if (!queues) {
        flag(device.devicesToSync.filter((id) => recipients.includes(id)));
        queues = place(empty());
        if (!queues) flag(recipients);
      }
      Object.assign(device, queues ?? empty());
      device.devicesToSync = queues ? [...recipients] : [];
    }
    device.lastSync = `${Date.now()}`;
    this.deviceWrites++;
    this.cloud.changed();
    return result;
  }
}

const fakeCrypto = {
  encrypt: (n) => ({ ...n, sealed: "k1" }),
  decrypt: (n) => {
    if (n.sealed !== "k1") return null;
    const { sealed: _sealed, ...plain } = n;
    return plain;
  },
  matches: (vault) => vault.key === "k1",
};

const makeDevice = async (cloud, name, opts = {}) => {
  const store = M.configureStore({
    reducer: { notes: M.notesReducer, categories: M.categoriesReducer, settings: (s = {}) => s },
    middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
    ...(opts.preloadedState && { preloadedState: opts.preloadedState }),
  });
  const backend = new FakeBackend(cloud, name);
  await backend.registerDevice({ uuid: name, modelName: name, brand: "test" });
  const events = [];
  const device = {
    name,
    store,
    backend,
    events,
    removed: false,
    stale: false,
    /** No key in the session (vault locked). */
    locked: false,
    /** The notes the engine made offline for their size (onTooLarge). */
    tooLarge: [],
    /** What the engine said about the cloud answering (onReachability), in order. */
    reach: [],
    /** What the engine reported, in order, with persist() calls ("persist" when one starts, "persisted" when done). */
    log: [],
    /** How long persist() takes. */
    persistMs: 0,
    live: () => store.getState().notes.items,
    trash: () => store.getState().notes.temporaryItems,
    get: (id) => store.getState().notes.items.find((n) => n.id === id),
    dispatch: (action) => store.dispatch(action),
  };
  device.engine = new M.SyncEngine({
    backend,
    me: name,
    store,
    actions: {
      applyNotesPlan: N.applyNotesPlan,
      notesPushed: N.notesPushed,
      dropNoteUploads: N.dropNoteUploads,
      detachNote: N.detachNote,
      adoptLegacyOutbox: N.adoptLegacyOutbox,
      applyCategoriesPlan: C.applyCategoriesPlan,
      categoriesPushed: C.categoriesPushed,
      addLocalCategories: C.addLocalCategories,
      deleteLocalCategories: C.deleteLocalCategories,
    },
    crypto: {
      encrypt: (n) => {
        if (device.locked) throw new Error("locked");
        return fakeCrypto.encrypt(n);
      },
      decrypt: (n) => (device.locked ? null : fakeCrypto.decrypt(n)),
      matches: (vault) => (device.locked ? null : fakeCrypto.matches(vault)),
    },
    persist: async () => {
      device.log.push("persist");
      await sleep(device.persistMs);
      device.log.push("persisted");
    },
    flushEditors: () => {},
    conflictSuffix: () => "(conflict)",
    ...(opts.keepVersion && { keepVersion: (note, reason) => opts.keepVersion(device, note, reason) }),
    timing: { pushMinInterval: 0, ackQuiet: 30, ackMaxWait: 150, ...opts.timing },
    events: {
      onApplied: (e) => {
        events.push(e);
        device.log.push("applied");
      },
      onDevices: () => {},
      onRemoved: () => (device.removed = true),
      onVaultStale: () => (device.stale = true),
      onTooLarge: (notes) => device.tooLarge.push(...notes),
      onReachability: (state) => device.reach.push({ ...state }),
    },
  });
  return device;
};

const newNote = (id, text, extra = {}) => ({
  id,
  type: "text",
  title: id,
  text,
  category: { order: 0, name: "All", icon: "none", index: true, selected: true },
  date: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
  ...extra,
});
const edit = (device, id, text) => {
  const current = device.get(id);
  device.dispatch(N.addNote({ ...current, text, updatedAt: Date.now() }));
};
const goOffline = (device) => (device.backend.online = false);
const goOnline = async (device) => {
  device.backend.online = true;
  await device.engine.resume();
};

/** Waits for the engines to go quiet (debounced pushes, snapshots, acks). */
const settle = async (devices, rounds = 6) => {
  for (let i = 0; i < rounds; i++) await sleep(260);
};

const contents = (device) =>
  device
    .live()
    .map((n) => `${n.id}=${n.text}`)
    .sort()
    .join(" | ");
const outboxEmpty = (device) => {
  const { add, delete: del, detach } = device.store.getState().notes.cloud.items;
  return Object.keys(add).length + Object.keys(del).length + Object.keys(detach ?? {}).length === 0;
};

const scenario = async (title, run) => {
  console.log(`\n${title}`);
  const cloud = new Cloud();
  const devices = [];
  const add = async (name, opts) => {
    const device = await makeDevice(cloud, name, opts);
    devices.push(device);
    return device;
  };
  try {
    await run({ cloud, add, settle: () => settle(devices) });
  } finally {
    devices.forEach((d) => d.engine.stop());
  }
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Devices                                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

await scenario("propagation", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  await settle();

  a.dispatch(N.addNote(newNote("n1", "hello")));
  await settle();
  ok("a new note reaches the other device", b.get("n1")?.text === "hello");
  ok("...and is in the cloud", cloud.notes.get("n1")?.text === "hello");
  ok("both outboxes are empty", outboxEmpty(a) && outboxEmpty(b));
  ok(
    "both know the note as synced",
    a.get("n1").syncedRev === M.noteRev(a.get("n1")) && b.get("n1").syncedRev === M.noteRev(b.get("n1"))
  );

  edit(a, "n1", "hello world");
  ok(
    "an edit leaves no undefined fields on the note (Firestore refuses them)",
    !Object.values(a.get("n1")).includes(undefined),
    a.get("n1")
  );
  await settle();
  ok("an edit reaches the other device", b.get("n1")?.text === "hello world");
  ok(
    "the receiver is told which note changed (live editor refresh)",
    b.events.some((e) => e.changed.includes("n1"))
  );
  ok("the sender's queue is cleared once acknowledged", cloud.devices.get("A").devicesToSync.length === 0);

  a.dispatch(N.temporaryDeleteNote("n1"));
  await settle();
  ok("a deletion moves it to the other device's trash", !b.get("n1") && b.trash().some((n) => n.id === "n1"));
  ok("...and removes it from the cloud", !cloud.notes.has("n1"));
});

await scenario("offline edits on both sides: both versions kept", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "base")));
  await settle();

  goOffline(b);
  edit(b, "n1", "edited on B");
  await sleep(5);
  edit(a, "n1", "edited on A");
  await settle();
  await goOnline(b);
  await settle();

  const ids = (d) =>
    d
      .live()
      .map((n) => n.id)
      .sort()
      .join();
  ok(
    "B's edit wasn't lost: a conflict copy exists",
    b.live().some((n) => n.id.startsWith("n1~"))
  );
  ok("both devices converge", contents(a) === contents(b), [contents(a), contents(b)]);
  ok("the newer edit (A) keeps the note", a.get("n1").text === "edited on A" && b.get("n1").text === "edited on A");
  ok("the other is the copy", a.live().find((n) => n.id.startsWith("n1~"))?.text === "edited on B");
  ok("one copy, not two", ids(a).split(",").length === 2, ids(a));
  ok("the cloud has both", cloud.notes.size === 2);
  ok(
    "the device that made the copy was told",
    b.events.some((e) => e.conflicts.length > 0) || a.events.some((e) => e.conflicts.length > 0)
  );
});

await scenario("edit after a deletion made elsewhere: the edit wins", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "base")));
  await settle();

  goOffline(b);
  a.dispatch(N.temporaryDeleteNote("n1"));
  await settle();
  await sleep(5);
  edit(b, "n1", "kept alive on B");
  await goOnline(b);
  await settle();

  ok("B keeps the note", b.get("n1")?.text === "kept alive on B");
  ok("A gets it back from the trash", a.get("n1")?.text === "kept alive on B" && !a.trash().some((n) => n.id === "n1"));
  ok("the cloud has it again", cloud.notes.get("n1")?.text === "kept alive on B");
});

await scenario(
  "deletion after an edit made elsewhere: the deletion wins, the edit is in the trash",
  async ({ cloud, add, settle }) => {
    const a = await add("A");
    const b = await add("B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "base")));
    await settle();

    goOffline(b);
    edit(b, "n1", "edited on B");
    await sleep(5);
    a.dispatch(N.temporaryDeleteNote("n1"));
    await settle();
    await goOnline(b);
    await settle();

    ok("B's note goes to the trash", !b.get("n1") && b.trash().some((n) => n.id === "n1"));
    ok("...with B's edit in it (recoverable)", b.trash().find((n) => n.id === "n1")?.text === "edited on B");
    ok("the cloud doesn't have it", !cloud.notes.has("n1"));
  }
);

await scenario("three devices: a stale queue replay doesn't bring back a deleted note", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  const c = await add("C");
  a.engine.start();
  b.engine.start();
  c.engine.start();
  a.dispatch(N.addNote(newNote("n1", "v1")));
  await settle();

  goOffline(c);
  edit(a, "n1", "v2");
  await settle();
  ok("B got v2", b.get("n1")?.text === "v2");
  b.dispatch(N.temporaryDeleteNote("n1"));
  await settle();
  b.dispatch(N.deleteNote("n1"));
  ok("B purged it", !b.get("n1") && !b.trash().some((n) => n.id === "n1"));

  // A pushes again: its queue (still holding n1 for C) is delivered to B once more.
  a.dispatch(N.addNote(newNote("n2", "other")));
  await settle();
  ok("B got the new note", b.get("n2")?.text === "other");
  ok(
    "B didn't get the deleted one back",
    !b.get("n1"),
    b.live().map((n) => n.id)
  );

  await goOnline(c);
  await settle();
  ok("C ends up with the deletion too", !c.get("n1") && c.get("n2")?.text === "other");
  ok(
    "all queues drain",
    [...cloud.devices.values()].every((d) => d.devicesToSync.length === 0)
  );
});

await scenario("a change queued while the receiver applies is not lost (guarded ack)", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "v1")));
  await settle();

  // B's acks fail while A keeps pushing: B must still end up with the last version, and A's queue must still drain.
  const ack = b.backend.ackChanges.bind(b.backend);
  let held = 0;
  b.backend.ackChanges = async (...args) => (held++ < 2 ? "error" : ack(...args));
  edit(a, "n1", "v2");
  await sleep(300);
  edit(a, "n1", "v3");
  await settle();
  await sleep(2500); // the engine's retry backoff
  await settle();
  ok("B has the latest version", b.get("n1")?.text === "v3", b.get("n1")?.text);
  ok("A's queue drained", cloud.devices.get("A").devicesToSync.length === 0);
});

await scenario("push based on an outdated version: merged, not overwritten", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "v1")));
  await settle();

  // B misses A's edit (its listener is deaf), then edits the old version.
  const listener = b.backend.listener;
  b.backend.listener = null;
  edit(a, "n1", "A's v2");
  await settle();
  await sleep(5);
  edit(b, "n1", "B's v2");
  await settle();
  b.backend.listener = listener;
  await b.engine.resume();
  await settle();

  ok("the cloud version wasn't blindly overwritten: both kept", contents(a) === contents(b) && a.live().length === 2, [
    contents(a),
    contents(b),
  ]);
  ok("B's (newer) edit keeps the note", a.get("n1")?.text === "B's v2");
});

// Before another device's version replaces a note here, the note as it was is kept (spec B.9): by the engine's
// dependency, before the store changes, on each of the three ways a version arrives.
{
  const kept = [];
  const spy = (device, note, reason) =>
    kept.push({ on: device.name, id: note.id, text: note.text, reason, storedThen: device.get(note.id)?.text });
  await scenario("a version is kept before another device's replaces a note", async ({ cloud, add, settle }) => {
    const a = await add("A");
    const b = await add("B", { keepVersion: spy });
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "v1")));
    await settle();
    ok("a note that only exists remotely keeps nothing", kept.length === 0, kept);

    edit(a, "n1", "v2");
    await settle();
    ok(
      "another device's queue: the local note, once, as 'sync', before the store changed",
      kept.length === 1 &&
        kept[0].on === "B" &&
        kept[0].text === "v1" &&
        kept[0].reason === "sync" &&
        kept[0].storedThen === "v1" &&
        b.get("n1")?.text === "v2",
      kept
    );

    kept.length = 0;
    a.dispatch(N.addNote({ ...a.get("n1"), important: true, updatedAt: Date.now() }));
    await settle();
    ok("only the flags or the revision differ: nothing kept", kept.length === 0 && b.get("n1")?.important === true, kept);

    // A full sync: B hears nothing, then syncs everything.
    const listener = b.backend.listener;
    b.backend.listener = null;
    edit(a, "n1", "v3");
    await settle();
    cloud.devices.get("B").addNotes = {};
    kept.length = 0;
    ok("full sync completes", await b.engine.fullSync());
    ok(
      "a full sync keeps the note it replaces",
      kept.length === 1 && kept[0].text === "v2" && kept[0].reason === "sync" && b.get("n1")?.text === "v3",
      kept
    );
    b.backend.listener = listener;
    await settle();

    // A refused push: B edits offline first, A edits later; B's push is refused and A's newer version replaces B's.
    goOffline(b);
    edit(b, "n1", "B, offline");
    await sleep(5);
    edit(a, "n1", "A, later");
    await settle();
    cloud.devices.get("B").addNotes = {};
    kept.length = 0;
    await goOnline(b);
    await settle();
    ok(
      "a refused push keeps the note it replaces",
      kept.some((k) => k.id === "n1" && k.text === "B, offline" && k.reason === "sync") && b.get("n1")?.text === "A, later",
      [kept, b.get("n1")?.text]
    );
  });
}

await scenario("full sync merges, never drops", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  a.dispatch(N.addNote(newNote("n1", "from A")));
  await settle();

  // B has its own notes before connecting, one of them an older copy of n1.
  b.dispatch(N.addNote(newNote("b1", "only on B")));
  ok("full sync completes", await b.engine.fullSync());
  b.engine.start();
  await settle();
  ok("B gets A's notes", b.get("n1")?.text === "from A");
  ok("B keeps and uploads its own", b.get("b1")?.text === "only on B" && cloud.notes.get("b1")?.text === "only on B");
  ok("A receives B's note", a.get("b1")?.text === "only on B");

  // The cloud is reset (e.g. a vault reset): a full sync puts everything back, nothing is dropped.
  cloud.notes.clear();
  ok("full sync after a cloud reset", await b.engine.fullSync());
  await settle();
  ok("the cloud gets B's notes again", cloud.notes.has("n1") && cloud.notes.has("b1"));
  ok("no note was dropped anywhere", b.live().length === 2 && a.live().length === 2);
});

await scenario("the cloud stops answering, then answers again: said once each way (ADR-029)", async ({ add, settle }) => {
  const a = await add("A");
  a.engine.start();
  await settle();
  ok(
    "its first answer: said once",
    a.reach.length === 1 && a.reach[0].failingSince === null && a.reach[0].lastContact !== null,
    a.reach
  );
  goOffline(a);
  await a.engine.resume();
  await settle();
  ok(
    "it fails: said once, with when it started and its last answer",
    a.reach.length === 2 && a.reach[1].failingSince !== null && a.reach[1].lastContact === a.reach[0].lastContact,
    a.reach
  );
  await a.engine.resume();
  await settle();
  ok("it still fails: not said again", a.reach.length === 2, a.reach);
  await goOnline(a);
  await settle();
  ok("it answers again: said", a.reach.length === 3 && a.reach[2].failingSince === null, a.reach);
  await a.engine.resume();
  await settle();
  ok("it keeps answering: not said again", a.reach.length === 3, a.reach);
  goOffline(a);
  await a.engine.resume();
  await settle();
  a.engine.stop();
  const last = a.reach.at(-1);
  ok("stopped: nothing to tell any more", last?.failingSince === null && last?.lastContact === null, a.reach);
});

await scenario("a listener that gets no answer tells, and keeps going (ADR-029)", async ({ add, settle }) => {
  const a = await add("A");
  a.engine.start();
  await settle();
  const said = a.reach.length;
  a.backend.listener.onLost();
  ok("lost: failing", a.reach.length === said + 1 && a.reach.at(-1).failingSince !== null, a.reach);
  a.backend.listener.onSnapshot({ ...a.backend.cloud.snapshot("A"), fromServer: false });
  ok("a snapshot not from the server: nothing said", a.reach.length === said + 1, a.reach);
  a.backend.emit();
  await settle();
  ok("its next snapshot from the server: it answers again", a.reach.at(-1).failingSince === null, a.reach);
});

await scenario("a stopped engine says nothing more about the cloud (ADR-029)", async ({ add, settle }) => {
  const a = await add("A");
  a.engine.start();
  await settle();
  // a slow vault read that fails (a server timing out), and sync turned off while it runs
  let release;
  a.backend.readVault = () => new Promise((resolve) => (release = () => resolve({ status: "error", vault: null })));
  a.engine.resume();
  await sleep(20);
  const listener = a.backend.listener;
  a.engine.stop();
  const said = a.reach.length;
  release();
  await a.engine.idle();
  ok("a read that fails after the stop: nothing said", a.reach.length === said, a.reach);
  listener.onLost();
  listener.onSnapshot(a.backend.cloud.snapshot("A"));
  ok("nor its listener's news", a.reach.length === said && a.reach.at(-1).lastContact === null, a.reach);
});

await scenario("full sync offline fails without touching anything", async ({ add }) => {
  const b = await add("B");
  b.dispatch(N.addNote(newNote("b1", "mine")));
  goOffline(b);
  ok("returns false", (await b.engine.fullSync()) === false);
  ok("the note is still there, still waiting to go out", b.get("b1")?.text === "mine" && !outboxEmpty(b));
});

await scenario(
  "a queue out of room: the receiver catches up with a full sync, deletions included",
  async ({ cloud, add, settle }) => {
    const a = await add("A");
    const b = await add("B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n0", "to delete")));
    await settle();

    goOffline(b);
    a.backend.maxQueuedEntries = 2;
    for (const i of [1, 2, 3]) a.dispatch(N.addNote(newNote(`n${i}`, `note ${i}`)));
    a.dispatch(N.temporaryDeleteNote("n0"));
    await settle();
    ok("B, which didn't pull the queues, is told to run a full sync", cloud.devices.get("B").fullSyncDue != null);
    ok("...and A's queues don't keep growing for it", Object.keys(cloud.devices.get("A").addNotes).length <= 2);
    await goOnline(b);
    await settle();
    ok(
      "B has every note that didn't fit",
      ["n1", "n2", "n3"].every((id) => b.get(id)),
      contents(b)
    );
    ok("B applied the deletion (its tombstone)", !b.get("n0") && b.trash().some((n) => n.id === "n0"));
    ok("B's flag clears once it synced", cloud.devices.get("B").fullSyncDue == null);
  }
);

await scenario("an upload the cloud refuses for good doesn't block the rest", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  await settle();
  a.backend.poison.add("big");
  a.dispatch(N.addNote(newNote("big", "x".repeat(10))));
  a.dispatch(N.addNote(newNote("n2", "small")));
  await settle();
  ok("the other note goes through", b.get("n2")?.text === "small" && cloud.notes.has("n2"));
  ok("the refused one stays queued (not lost)", "big" in a.store.getState().notes.cloud.items.add);
  const pushes = a.backend.pushes;
  await settle();
  ok("...and isn't retried in a loop", a.backend.pushes - pushes <= 1, a.backend.pushes - pushes);
});

await scenario(
  "a note over the cloud's limit becomes offline on every device, each keeping its copy",
  async ({ cloud, add, settle }) => {
    const a = await add("A");
    const b = await add("B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("big", "small for now")));
    a.dispatch(N.addNote(newNote("n2", "other")));
    await settle();
    ok("B has the note while it fits", b.get("big")?.text === "small for now");
    // A cloud with a smaller limit (another cloud, or the server's MAX_NOTE_MB lowered), and the note grows past it.
    a.backend.maxNoteBytes = b.backend.maxNoteBytes = 1000;
    edit(a, "big", "x".repeat(2000));
    await settle();
    ok("A keeps it, offline", a.get("big")?.local === true && a.get("big").text === "x".repeat(2000));
    ok(
      "A was told once, with the note's title",
      a.tooLarge.length === 1 && a.tooLarge[0].id === "big" && a.tooLarge[0].title === "big",
      a.tooLarge
    );
    ok("it left the cloud", !cloud.notes.has("big"));
    ok("B keeps its copy, offline", b.get("big")?.local === true && b.get("big").text === "small for now", b.get("big"));
    ok("B wasn't told (nothing of its own went offline)", b.tooLarge.length === 0, b.tooLarge);
    ok("nothing of it left in A's outbox", !("big" in a.store.getState().notes.cloud.items.add));
    ok("the other note still syncs", !a.get("n2").local && cloud.notes.has("n2"));
    const pushes = a.backend.pushes;
    await settle();
    ok("...and no push loop", a.backend.pushes - pushes <= 1, a.backend.pushes - pushes);
  }
);

await scenario("clock behind: an edit still supersedes what it was based on", async ({ add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  // A's clock is an hour ahead.
  const future = Date.now() + 3600_000;
  a.dispatch(N.addNote(newNote("n1", "from the future", { createdAt: future, updatedAt: future })));
  await settle();
  edit(b, "n1", "edited on B now");
  await settle();
  ok("B's later edit wins on A too", a.get("n1")?.text === "edited on B now");
});

await scenario("detach, categories, offline device catching up", async ({ add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "shared")));
  a.dispatch(C.createCategory({ name: "Work", icon: "work" }));
  await settle();
  ok(
    "a category reaches the other device",
    b.store.getState().categories.items.some((c) => c.icon === "work")
  );
  ok(
    "...without changing which one is selected there",
    b.store.getState().categories.items.find((c) => c.selected)?.icon === "none"
  );

  a.dispatch(N.detachNote("n1"));
  await settle();
  ok("detach makes the other device's copy device-only", b.get("n1")?.local === true);

  goOffline(b);
  a.dispatch(N.addNote(newNote("n2", "while B was away")));
  a.dispatch(C.deleteCategory(a.store.getState().categories.items.find((c) => c.icon === "work")));
  await settle();
  await goOnline(b);
  await settle();
  ok("B catches up on notes", b.get("n2")?.text === "while B was away");
  ok("B catches up on categories", !b.store.getState().categories.items.some((c) => c.icon === "work"));
});

await scenario("editing a note in the trash brings it back (no duplicate)", async ({ add, settle }) => {
  const a = await add("A");
  a.engine.start();
  a.dispatch(N.addNote(newNote("n1", "v1")));
  await settle();
  const stale = a.get("n1");
  a.dispatch(N.temporaryDeleteNote("n1"));
  // An editor still open on it commits.
  a.dispatch(N.addNote({ ...stale, text: "typed after the delete", updatedAt: Date.now() }));
  ok("the note is live again, once", a.live().filter((n) => n.id === "n1").length === 1);
  ok("...and no longer in the trash", !a.trash().some((n) => n.id === "n1"));
});

await scenario("presence", async ({ cloud, add, settle }) => {
  const a = await add("A");
  a.engine.start();
  await settle();
  const shown = () => cloud.devices.get("A").presence?.noteId ?? null;

  a.engine.setPresence("n1");
  await settle();
  ok("an open note is shown to the others", shown() === "n1");
  a.engine.releasePresence("n1");
  await settle();
  ok("...and cleared once closed", shown() === null);

  // The page was reloaded (or the app killed) with a note open: nothing cleared it.
  cloud.devices.get("A").presence = { noteId: "n9", at: Date.now() };
  cloud.changed();
  await settle();
  ok("a presence left over from an ended session is cleared", shown() === null);

  a.engine.setPresence("n2");
  cloud.devices.get("A").presence = { noteId: "n9", at: Date.now() };
  cloud.changed();
  await settle();
  ok("...without overriding a note opened meanwhile", shown() === "n2");
});

await scenario("an open editor hears of a change before it's written to disk", async ({ add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  await settle();
  a.dispatch(N.addNote(newNote("n1", "v1")));
  await settle();

  // Writing the whole store takes a while with many notes: an editor's batched commit must not land in between, over a
  // copy that doesn't have the change yet.
  b.persistMs = 500;
  b.log.length = 0;
  edit(a, "n1", "v2");
  await settle();
  ok(
    "the change is reported before the persisted write completes",
    b.log.indexOf("applied") < b.log.indexOf("persisted"),
    b.log
  );
});

await scenario("locked: sync waits, and never takes the key for a stale one", async ({ add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  b.engine.start();
  a.locked = true;
  ok("a full sync while locked doesn't complete", (await a.engine.fullSync()) === false);
  a.engine.start();
  b.dispatch(N.addNote(newNote("n1", "from B")));
  await settle();
  ok("...the key isn't taken for stale", !a.stale);
  ok("...and nothing unreadable was merged", !a.get("n1"));
  a.locked = false;
  ok("unlocked, a full sync completes", (await a.engine.fullSync()) === true);
  ok("...and brings what was waiting", a.get("n1")?.text === "from B");
});

/* ------------------------------------------------------------------------------------------------------------------ */
/* Upgrading from (and syncing with) older app versions                                                               */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A device's state as an older app version left it on disk. */
const preloaded = (notes, outbox = {}) => {
  const initial = M.notesReducer(undefined, { type: "@@init" });
  return {
    notes: {
      ...initial,
      items: notes.map(clone),
      cloud: { items: { add: {}, delete: {}, detach: {}, ...clone(outbox) } },
    },
    categories: M.categoriesReducer(undefined, { type: "@@init" }),
  };
};
const everywhere = (cloud, devices) => [
  ...devices.flatMap((d) => [...d.live(), ...d.trash()].map((n) => n.text)),
  ...[...cloud.notes.values()].map((n) => n.text),
];

await scenario("notes from an older version: concurrent offline edits keep both", async ({ cloud, add, settle }) => {
  const t = Date.now() - 100000;
  const base = legacy("n1", t, { text: "base" });
  cloud.notes.set("n1", { ...base, sealed: "k1" });
  const a = await add("A", { preloadedState: preloaded([base]) });
  const b = await add("B", { preloadedState: preloaded([base]) });
  a.engine.start();
  b.engine.start();
  await settle();

  goOffline(b);
  edit(a, "n1", "edit on A");
  await settle();
  await sleep(5);
  edit(b, "n1", "edit on B (later)");
  await goOnline(b);
  await settle();
  ok("A's edit survives (note or conflict copy)", everywhere(cloud, [a, b]).includes("edit on A"), {
    A: contents(a),
    B: contents(b),
  });
  ok("so does B's", everywhere(cloud, [a, b]).includes("edit on B (later)"));
});

await scenario(
  "a note an older version received from a newer one: no conflict copy after the update",
  async ({ cloud, add, settle }) => {
    // N (updated) wrote both notes; U, still on the older version, stored them with their revisions and no syncedRev.
    // U had also edited n2 there (updatedAt only) without an upload waiting (locked, or not connected at the time).
    const t = Date.now() - 100000;
    const n1 = note("n1", t, { text: "from N", updatedAt: t - 1 });
    const n2 = note("n2", t, { text: "from N", updatedAt: t - 1 });
    cloud.notes.set("n1", { ...n1, sealed: "k1" });
    cloud.notes.set("n2", { ...n2, sealed: "k1" });
    const synced = (n) => ({ ...n, syncedRev: n.rev });
    const updated = preloaded([n1, { ...n2, text: "edited on the older version", updatedAt: t + 10 }]);
    // What the notes' persist migration does on the first launch of the update.
    const migrated = M.fromOlderVersion({ ...updated.notes, _persist: { version: -1, rehydrated: true } });
    const { _persist: _version, ...notes } = migrated;
    const u = await add("U", { preloadedState: { ...updated, notes } });
    const n = await add("N", { preloadedState: preloaded([synced(n1), synced(n2)]) });
    u.engine.start();
    n.engine.start();
    await settle();

    edit(n, "n1", "N's next edit");
    edit(n, "n2", "N's next edit");
    await settle();
    const copies = (d) => d.live().filter((x) => x.id.includes("~"));
    ok("U takes N's next edit", u.get("n1")?.text === "N's next edit");
    ok("...without a conflict copy of the version it had", !copies(u).some((x) => x.id.startsWith("n1~")), contents(u));
    ok("the note U edited on the older version keeps both", everywhere(cloud, [u, n]).includes("edited on the older version"), {
      U: contents(u),
      N: contents(n),
    });
    ok("...and N's edit", u.get("n2")?.text === "N's next edit" || copies(u).some((x) => x.text === "N's next edit"));
    ok("both devices end up with the same notes", contents(u) === contents(n), { U: contents(u), N: contents(n) });
  }
);

await scenario(
  "an upload an older version left queued goes out, on top of the version it changes",
  async ({ cloud, add, settle }) => {
    const t = Date.now() - 100000;
    const base = legacy("n1", t, { text: "base" });
    cloud.notes.set("n1", { ...base, sealed: "k1" });
    // It marked the note important (no new revision) while offline, then the app was updated.
    const toggled = { ...base, important: true };
    const a = await add("A", { preloadedState: preloaded([toggled], { add: { n1: { ...toggled, sealed: "outbox" } } }) });
    const b = await add("B", { preloadedState: preloaded([base]) });
    a.engine.start();
    b.engine.start();
    await settle();
    ok("it reaches the cloud", cloud.notes.get("n1")?.important === true);
    ok("...and the other device", b.get("n1")?.important === true);
    ok("A's outbox drains", outboxEmpty(a));
  }
);

await scenario(
  "...also for a note it had received from a newer version (same revision as the cloud's)",
  async ({ cloud, add, settle }) => {
    const t = Date.now() - 100000;
    const base = note("n1", t, { text: "from N", updatedAt: t - 1 });
    cloud.notes.set("n1", { ...base, sealed: "k1" });
    const toggled = { ...base, important: true };
    const older = preloaded([toggled], { add: { n1: { ...toggled, sealed: "outbox" } } });
    const { _persist: _version, ...notes } = M.fromOlderVersion({
      ...older.notes,
      _persist: { version: -1, rehydrated: true },
    });
    const a = await add("A", { preloadedState: { ...older, notes } });
    const n = await add("N", { preloadedState: preloaded([{ ...base, syncedRev: base.rev }]) });
    a.engine.start();
    n.engine.start();
    await settle();
    ok("it reaches the cloud", cloud.notes.get("n1")?.important === true, cloud.notes.get("n1"));
    ok("...and the other device", n.get("n1")?.important === true);
    ok("...with no conflict copy", ![...a.live(), ...n.live()].some((x) => x.id.includes("~")), {
      A: contents(a),
      N: contents(n),
    });
    ok("A's outbox drains", outboxEmpty(a));
  }
);

await scenario(
  "a note an older version queued for both upload and deletion stays (it's live)",
  async ({ cloud, add, settle }) => {
    const base = legacy("n1", Date.now() - 100000, { text: "restored" });
    cloud.notes.set("n1", { ...base, sealed: "k1" });
    const stub = { id: "n1", type: "text", updatedAt: base.updatedAt };
    const a = await add("A", {
      preloadedState: preloaded([base], { add: { n1: { ...base, sealed: "outbox" } }, delete: { n1: stub } }),
    });
    const b = await add("B", { preloadedState: preloaded([base]) });
    a.engine.start();
    b.engine.start();
    await settle();
    ok("still in the cloud", cloud.notes.has("n1"));
    ok("still live on the other device", b.get("n1")?.text === "restored");
  }
);

await scenario("an older version's change without a new revision is taken", async ({ cloud, add, settle }) => {
  const base = legacy("n1", Date.now() - 100000, { text: "base" });
  cloud.notes.set("n1", { ...base, sealed: "k1" });
  const b = await add("B", { preloadedState: preloaded([base]) });
  b.engine.start();
  await settle();
  // Device O, still on the older version, marks it locked: same updatedAt, queued for B.
  const locked = { ...base, locked: true, sealed: "k1" };
  cloud.notes.set("n1", locked);
  cloud.devices.set("O", { uuid: "O", lastSync: "0", devicesToSync: ["B"], ...Object.fromEntries(QUEUES.map((q) => [q, {}])) });
  cloud.devices.get("O").addNotes.n1 = clone(locked);
  cloud.changed();
  await settle();
  ok("the updated device takes it", b.get("n1")?.locked === true);
  edit(b, "n1", "edited on B");
  await settle();
  ok("...and its next edit keeps it", cloud.notes.get("n1")?.locked === true && cloud.notes.get("n1")?.text === "edited on B");
});

await scenario(
  "deleted here for good, edited elsewhere later: the edit wins, without a push loop",
  async ({ cloud, add, settle }) => {
    const a = await add("A");
    const b = await add("B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "base")));
    await settle();

    goOffline(a);
    a.dispatch(N.temporaryDeleteNote("n1"));
    a.dispatch(N.deleteNote("n1"));
    await sleep(5);
    edit(b, "n1", "edited on B after the deletion");
    await settle();
    await goOnline(a);
    await settle();
    const pushes = a.backend.pushes;
    await sleep(3000);
    ok("the newer edit comes back on A", a.get("n1")?.text === "edited on B after the deletion");
    ok("A's outbox drains", outboxEmpty(a), a.store.getState().notes.cloud.items);
    ok("A doesn't keep pushing", a.backend.pushes - pushes <= 1, { pushes: a.backend.pushes - pushes });
  }
);

await scenario("recipients: a removed device doesn't stay one", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  await settle();
  // An id left in A's recipients (a device removed while A was pushing).
  cloud.devices.get("A").devicesToSync = ["X"];
  cloud.devices.get("A").addNotes = { old: { id: "old" } };
  a.dispatch(N.addNote(newNote("n1", "hello")));
  await settle();
  ok(
    "the queues clear once the real recipients pulled them",
    cloud.devices.get("A").devicesToSync.length === 0,
    cloud.devices.get("A").devicesToSync
  );
});

await scenario("a change that couldn't be written to disk isn't acknowledged", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  await settle();
  const persist = b.engine.o.persist;
  b.engine.o.persist = async () => {
    throw new Error("disk full");
  };
  a.dispatch(N.addNote(newNote("n1", "hello")));
  await settle();
  ok("the sender keeps it queued for B", cloud.devices.get("A").devicesToSync.includes("B"));
  b.engine.o.persist = persist;
  await b.engine.resume();
  await sleep(2500); // the retry's backoff
  await settle();
  ok("acknowledged once it's on disk", !cloud.devices.get("A").devicesToSync.includes("B"));
});

await scenario("a note refused for good (size) can still be deleted", async ({ cloud, add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("big", "small at first")));
  await settle();
  a.backend.poison.add("big");
  edit(a, "big", "now too big");
  await settle();
  a.backend.poison.delete("big");
  a.dispatch(N.temporaryDeleteNote("big"));
  await settle();
  ok("the deletion reaches the cloud and the other device", !cloud.notes.has("big") && !b.get("big"));
});

await scenario("categories: a change waiting here isn't undone by an incoming one", async ({ add, settle }) => {
  const a = await add("A");
  const b = await add("B");
  a.engine.start();
  b.engine.start();
  a.dispatch(C.createCategory({ name: "Work", icon: "work" }));
  await settle();
  goOffline(b);
  a.dispatch(C.deleteCategory(a.store.getState().categories.items.find((c) => c.icon === "work")));
  await settle();
  const work = b.store.getState().categories.items.find((c) => c.icon === "work");
  b.dispatch(C.updateCategory({ nextCategory: { name: "Job", icon: "work" }, prevCategory: work, index: false }));
  await goOnline(b);
  await settle();
  const name = (d) => d.store.getState().categories.items.find((c) => c.icon === "work")?.name ?? "-";
  ok("the devices agree", name(a) === name(b), { A: name(a), B: name(b) });
});

await scenario("cost: pushes are spaced, acknowledgements wait for the sender to go quiet", async ({ cloud, add, settle }) => {
  // As in the app (2 s, 5 s, 30 s), scaled down.
  const timing = { pushMinInterval: 800, ackQuiet: 2000, ackMaxWait: 12000 };
  const a = await add("A", { timing });
  const b = await add("B", { timing });
  a.engine.start();
  b.engine.start();
  a.dispatch(N.addNote(newNote("n1", "v0")));
  await sleep(3000);
  const pushes = a.backend.pushes;
  const acks = b.backend.acks;
  for (let i = 1; i <= 12; i++) {
    edit(a, "n1", `v${i}`);
    await sleep(250);
  }
  await sleep(1000);
  ok("typing for 3 s takes at most 5 pushes", a.backend.pushes - pushes <= 5, { pushes: a.backend.pushes - pushes });
  ok("the other device has the latest", b.get("n1")?.text === "v12");
  ok("...without acknowledging every push while A types", b.backend.acks === acks, { acks: b.backend.acks - acks });
  await sleep(2500);
  ok("it acknowledges once A goes quiet", b.backend.acks === acks + 1 && !cloud.devices.get("A").devicesToSync.includes("B"));

  const writes = a.backend.deviceWrites;
  b.dispatch(N.addNote(newNote("n2", "from B")));
  await sleep(2500);
  // A push of only what the cloud already has (a superseded upload) writes nothing.
  a.engine.kick(0);
  await sleep(500);
  ok("a push that applies nothing doesn't write the device doc", a.backend.deviceWrites === writes);
});

await scenario(
  "stop: a task still running doesn't act on what it reads (the cloud may be left or switched)",
  async ({ add, settle }) => {
    const a = await add("A");
    a.engine.start();
    await settle();
    // Stopped: no listener snapshot can replace the reads below (a full sync runs anyway).
    a.engine.stop();

    // A full sync in flight when the engine stops (leaving the cloud), which then reads a list without this device.
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    let reading = false;
    const gone = { devices: [], incoming: [], fromServer: true };
    a.backend.pullDevices = async () => {
      reading = true;
      await gate;
      return gone;
    };
    const first = a.engine.fullSync();
    await until(() => reading, 2000);
    a.engine.stop();
    let idle = false;
    const idling = a.engine.idle().then(() => (idle = true));
    await sleep(50);
    ok("idle() waits for the running task", reading && !idle);
    release();
    await first;
    await idling;
    ok("...which, outliving stop(), doesn't take the list it read for a removal", !a.removed);

    // One that reads a vault this key doesn't open (the next cloud's, or none yet): not a stale key either.
    const b = await add("B");
    let releaseVault;
    const vaultGate = new Promise((resolve) => (releaseVault = resolve));
    let readingVault = false;
    b.backend.readVault = async () => {
      readingVault = true;
      await vaultGate;
      return { status: "present", vault: { key: "another cloud's" } };
    };
    const second = b.engine.fullSync();
    await until(() => readingVault, 2000);
    b.engine.stop();
    releaseVault();
    await second;
    ok("...nor the vault it read for a stale key", !b.stale);

    // One with something to push: neither pushed nor acknowledged.
    const c = await add("C");
    let releaseSync;
    const syncGate = new Promise((resolve) => (releaseSync = resolve));
    let pulling = false;
    const snapshot = c.backend.pullDevices.bind(c.backend);
    c.backend.pullDevices = async (me) => {
      pulling = true;
      await syncGate;
      return snapshot(me);
    };
    c.dispatch(N.addNote(newNote("late", "written while leaving")));
    const pushes = c.backend.pushes;
    const third = c.engine.fullSync();
    await until(() => pulling, 2000);
    c.engine.stop();
    releaseSync();
    ok("...a full sync that outlived stop() reports it didn't complete", (await third) === false);
    ok("...and pushed nothing", c.backend.pushes === pushes && !c.backend.cloud.notes.has("late"));

    // Control: not stopped, the same reads are a removal and a stale key.
    a.backend.pullDevices = async () => gone;
    await a.engine.fullSync();
    b.backend.readVault = async () => ({ status: "present", vault: { key: "another cloud's" } });
    await b.engine.fullSync();
    ok("(not stopped meanwhile, the same reads are a removal and a stale key)", a.removed && b.stale);
  }
);

/* ------------------------------------------------------------------------------------------------------------------ */
/* The upload queue holds markers (ADR-036, LL-017)                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

await scenario("the upload queue holds markers", async ({ cloud, add, settle }) => {
  const a = await add("A");
  a.engine.start();
  await settle();

  globalThis.__sliceEncrypts = 0;
  a.dispatch(N.addNote(newNote("m1", "uno")));
  const first = a.store.getState().notes.cloud.items.add.m1;
  ok(
    "a commit queues a marker",
    first !== undefined &&
      JSON.stringify(Object.keys(first).sort()) === '["id","rev"]' &&
      first.id === "m1" &&
      first.rev === M.noteRev(a.get("m1")),
    first
  );
  ok("a commit encrypts nothing", globalThis.__sliceEncrypts === 0, globalThis.__sliceEncrypts);
  edit(a, "m1", "due");
  ok("each commit makes a new entry", a.store.getState().notes.cloud.items.add.m1 !== first);
  await settle();
  ok(
    "the push uploads the stored note, encrypted by the engine",
    cloud.notes.get("m1")?.sealed === "k1" && cloud.notes.get("m1")?.text === "due",
    cloud.notes.get("m1")
  );
  ok("...and empties the queue", !("m1" in a.store.getState().notes.cloud.items.add));

  // An edit made while a push is on its way: the push's answer doesn't dequeue the newer marker.
  const realPush = a.backend.push.bind(a.backend);
  const releases = [];
  let calls = 0;
  a.backend.push = async (...args) => {
    calls++;
    await new Promise((resolve) => releases.push(resolve));
    return realPush(...args);
  };
  edit(a, "m1", "tre");
  await until(() => calls === 1);
  edit(a, "m1", "quattro");
  const newer = a.store.getState().notes.cloud.items.add.m1;
  releases[0]();
  await until(() => calls === 2);
  ok("an edit made while a push is on its way stays queued", a.store.getState().notes.cloud.items.add.m1 === newer);
  a.backend.push = realPush;
  releases[1]();
  await settle();
  ok("...and goes out with the next push", cloud.notes.get("m1")?.text === "quattro" && outboxEmpty(a), cloud.notes.get("m1"));
});

await scenario("entries written by 4.0.0 (encrypted copies) are pushed as the stored note", async ({ cloud, add, settle }) => {
  const t = Date.now() - 100000;
  const stored = note("old1", t, { text: "vecchia", syncedRev: t - 10 });
  // 4.0.0 queued an encrypted copy; the stored note is what goes out (the copy only says "waiting").
  const b = await add("B", {
    preloadedState: preloaded([stored], { add: { old1: { ...stored, text: "copy", sealed: "outbox" } } }),
  });
  b.engine.start();
  await settle();
  ok(
    "a 4.0.0 entry is pushed as the stored note",
    cloud.notes.get("old1")?.sealed === "k1" && cloud.notes.get("old1")?.text === "vecchia",
    cloud.notes.get("old1")
  );
  ok("...and leaves the queue", !("old1" in b.store.getState().notes.cloud.items.add));
});

await scenario("a locked vault queues nothing and still cancels a pending deletion", async ({ add }) => {
  const n2 = note("n2", 2000, { text: "x", syncedRev: 2000 });
  const d = await add("D", { preloadedState: preloaded([n2], { delete: { n2: { id: "n2", rev: 2000 } } }) });
  globalThis.__vaultLocked = true;
  try {
    d.dispatch(N.addNote({ ...d.get("n2"), text: "y" }));
    const { add: up, delete: down } = d.store.getState().notes.cloud.items;
    ok("a locked vault queues nothing", !("n2" in up));
    ok("...and the pending deletion is cancelled", !("n2" in down));
  } finally {
    globalThis.__vaultLocked = false;
  }
  d.dispatch(N.addNote({ ...d.get("n2"), text: "z" }));
  ok("unlocked again, a commit queues its marker", d.store.getState().notes.cloud.items.add.n2?.id === "n2");
});

console.log("\nduplicate: the copy goes through addNote (spec A.4)");
{
  const original = note("o1", 100, { syncedRev: 100 });
  const offline = note("o2", 200, { syncedRev: 200, local: true });
  const base = M.notesReducer(undefined, { type: "@@init" });
  const store = M.configureStore({
    reducer: { notes: M.notesReducer },
    preloadedState: { notes: { ...base, items: [original, offline] } },
  });
  let n = 0;
  const fresh = (id) => ({ id, now: 5000, date: "D", newId: () => "x" + ++n });
  store.dispatch(M.notes.addNote(M.copyOfNote(original, fresh("c1"))));
  store.dispatch(M.notes.addNote(M.copyOfNote(offline, fresh("c2"))));
  const state = store.getState().notes;
  const byId = (id) => state.items.find((x) => x.id === id);
  const queued = Object.keys(state.cloud.items.add);
  ok(
    "the copy gets a revision and is queued for upload once",
    typeof byId("c1")?.rev === "number" && queued.filter((id) => id === "c1").length === 1,
    { rev: byId("c1")?.rev, queued }
  );
  ok("the copy of an offline note is queued nowhere", byId("c2")?.local === true && !queued.includes("c2"), queued);
  ok(
    "the original's revision and queue entry don't change",
    byId("o1").rev === 100 && byId("o1").syncedRev === 100 && !queued.includes("o1") && !queued.includes("o2"),
    byId("o1")
  );
}

console.log("\nrestore: a kept version comes back as an ordinary edit (spec B.9)");
{
  const work = { order: 1, name: "Work", icon: "work", index: false, selected: false };
  const live = note("r1", 100, { syncedRev: 100, title: "now", text: "new text", important: true, category: work });
  const readOnly = note("r2", 100, { syncedRev: 100, readOnly: true });
  const trashed = note("r3", 100, { syncedRev: 100 });
  globalThis.__versions = {
    "r1:v1": { type: "text", title: "before", text: "old text" },
    "r2:v1": { type: "text", title: "before", text: "old text" },
    "r3:v1": { type: "text", title: "before", text: "old text" },
    "r1:list": { type: "todo", title: "a list", list: [], mode: "free" },
  };
  const make = () => {
    const base = M.notesReducer(undefined, { type: "@@init" });
    return M.configureStore({
      reducer: { notes: M.notesReducer },
      preloadedState: { notes: { ...base, items: [clone(live), clone(readOnly)], temporaryItems: [clone(trashed)] } },
    });
  };
  const restore = (store, noteId, versionId) => store.dispatch(M.restoreVersion({ noteId, versionId })).unwrap();
  const record = () => {
    globalThis.__kept = [];
    globalThis.__notified = [];
    globalThis.__webhooks = [];
  };

  record();
  const store = make();
  const done = await restore(store, "r1", "v1");
  const state = store.getState().notes;
  const restored = state.items.find((x) => x.id === "r1");
  ok("it answers true", done === true);
  ok("the note has the old title and content", restored?.title === "before" && restored?.text === "old text", restored);
  ok(
    "...with today's flags and category",
    restored?.important === true && restored?.readOnly === false && restored?.category?.icon === "work",
    restored
  );
  ok("...a newer revision and updatedAt", restored?.rev > 100 && restored?.updatedAt > 100, restored);
  ok(
    "...and is queued for upload once",
    Object.keys(state.cloud.items.add).filter((id) => id === "r1").length === 1,
    Object.keys(state.cloud.items.add)
  );
  ok(
    "the version kept first holds the content from before the restore",
    globalThis.__kept.length === 1 &&
      globalThis.__kept[0].reason === "restore" &&
      globalThis.__kept[0].note.title === "now" &&
      globalThis.__kept[0].note.text === "new text",
    globalThis.__kept
  );
  ok("an open editor is told", globalThis.__notified.join() === "r1", globalThis.__notified);
  ok(
    "the user's webhook gets the edit",
    globalThis.__webhooks.length === 1 &&
      globalThis.__webhooks[0].action === "note/updateNote" &&
      globalThis.__webhooks[0].text === "old text",
    globalThis.__webhooks
  );

  for (const [name, noteId, versionId] of [
    ["a read-only note", "r2", "v1"],
    ["a note in the trash", "r3", "v1"],
    ["a missing note", "zz", "v1"],
    ["a missing version", "r1", "nope"],
    ["a version of another type", "r1", "list"],
  ]) {
    record();
    const s = make();
    const before = s.getState().notes;
    const answer = await restore(s, noteId, versionId);
    ok(
      `${name}: false, and nothing changes`,
      answer === false &&
        s.getState().notes === before &&
        !globalThis.__kept.length &&
        !globalThis.__notified.length &&
        !globalThis.__webhooks.length,
      { answer, kept: globalThis.__kept }
    );
  }
  globalThis.__kept = globalThis.__notified = globalThis.__webhooks = undefined;
}

console.log("\ncategories: a drop reorders, renumbers, and queues only what changed");
{
  const cat = (icon, order) => ({ name: icon, icon, order, index: icon === "all", selected: icon === "all" });
  const make = (items) => {
    const base = M.categoriesReducer(undefined, { type: "@@init" });
    return M.configureStore({
      reducer: { categories: M.categoriesReducer },
      preloadedState: { categories: { ...base, items } },
    });
  };
  const icons = (s) =>
    s
      .getState()
      .categories.items.map((c) => c.icon)
      .join();
  const orders = (s) =>
    s
      .getState()
      .categories.items.map((c) => c.order)
      .join();
  const queued = (s) => Object.keys(s.getState().categories.cloud.items.add).sort().join();

  const s = make(["all", "a", "b", "c", "d"].map((icon, i) => cat(icon, i)));
  s.dispatch(C.moveCategory({ icon: "c", toIndex: 0 }));
  ok("c first after All", icons(s) === "all,c,a,b,d", icons(s));
  ok("renumbered 0..4", orders(s) === "0,1,2,3,4", orders(s));
  ok("only the categories whose order changed are queued", queued(s) === "a,b,c", queued(s));

  const before = s.getState().categories;
  s.dispatch(C.moveCategory({ icon: "a", toIndex: 1 }));
  ok("its own slot: nothing changes", s.getState().categories === before);
  s.dispatch(C.moveCategory({ icon: "zz", toIndex: 0 }));
  ok("an unknown icon: nothing changes", s.getState().categories === before);
  s.dispatch(C.moveCategory({ icon: "all", toIndex: 3 }));
  ok("All can't move", s.getState().categories === before);

  const gaps = make([cat("all", 0), cat("a", 5), cat("b", 9), cat("c", 12)]);
  gaps.dispatch(C.moveCategory({ icon: "a", toIndex: 2 }));
  ok("gaps from older orders close", icons(gaps) === "all,b,a,c" && orders(gaps) === "0,1,2,3", [icons(gaps), orders(gaps)]);

  const ties = make([cat("all", 0)]);
  ties.dispatch(C.addLocalCategories({ z: cat("z", 1), m: cat("m", 1) }));
  ok("equal orders sort by icon", icons(ties) === "all,m,z", icons(ties));

  const plan = M.reconcileCategories([cat("all", 0)], { add: {}, delete: {} }, [cat("z", 1), cat("m", 1)]);
  ok(
    "a full sync sorts equal orders by icon too",
    plan.items.map((c) => c.icon).join() === "all,m,z",
    plan.items.map((c) => c.icon)
  );

  const gapped = make([cat("all", 0), cat("a", 2), cat("b", 3)]);
  gapped.dispatch(C.createCategory({ name: "c", icon: "c" }));
  ok(
    "a new category goes after the last one, whatever the gaps",
    orders(gapped) === "0,2,3,4" && icons(gapped) === "all,a,b,c",
    [icons(gapped), orders(gapped)]
  );

  const counts = N.getNotesCountByCategory({
    notes: { items: [{ category: { icon: "a" } }, { category: { icon: "a" } }, { category: { icon: "b" } }] },
  });
  ok(
    "notes counted by category in one pass, and in all",
    counts.byIcon.a === 2 && counts.byIcon.b === 1 && counts.total === 3,
    counts
  );
}

console.log("\na list's hideDone (spec B.7)");
{
  const list = (rev, extra = {}) =>
    note("l", rev, { type: "todo", text: undefined, list: [{ id: "i", text: "x", checked: true }], mode: "free", ...extra });
  ok("hideDone goes up with the note", M.forUpload(list(100, { hideDone: true, syncedRev: 100 })).hideDone === true);
  const p = M.createPlanner(local([list(100, { syncedRev: 100 })]), "(c)");
  p.add(list(200, { hideDone: true }));
  const plan = p.plan();
  ok(
    "a newer copy that only turned hideDone on replaces the note, with it",
    plan.put.length === 1 && plan.put[0].hideDone === true,
    plan.put
  );
  const q = M.createPlanner(local([list(300, { hideDone: true, syncedRev: 200 })], [], { pendingUploads: { l: {} } }), "(c)");
  q.add(list(200));
  const older = q.plan();
  ok("an older copy without it doesn't undo the local change", older.put.length === 0 && older.conflicts.length === 0, older);
}

console.log("\na reminder travels with the note (spec D.5)");
{
  const at = 9_000_000_000_000;
  ok("remindAt goes up with the note", M.forUpload(note("r", 100, { remindAt: at, syncedRev: 100 })).remindAt === at);
  ok(
    "removed, the upload has no remindAt key",
    !("remindAt" in M.forUpload(M.withReminder(note("r", 100, { remindAt: at }), null)))
  );
  const p = M.createPlanner(local([note("r", 100, { syncedRev: 100 })]), "(c)");
  p.add(note("r", 200, { remindAt: at }));
  const plan = p.plan();
  ok(
    "a newer copy that only set a reminder replaces the note, with it",
    plan.put.length === 1 && plan.put[0].remindAt === at,
    plan.put
  );
  const base = M.notesReducer(undefined, { type: "@@init" });
  const store = M.configureStore({
    reducer: { notes: M.notesReducer },
    preloadedState: { notes: { ...base, items: [note("r", 100, { syncedRev: 100 })] } },
  });
  store.dispatch(M.notes.applyNotesPlan(plan));
  ok(
    "the remote copy with it lands in the store",
    store.getState().notes.items.find((x) => x.id === "r")?.remindAt === at,
    store.getState().notes.items
  );
  const editStore = M.configureStore({
    reducer: { notes: M.notesReducer },
    preloadedState: { notes: { ...base, items: [note("e", 100, { syncedRev: 100 })] } },
  });
  editStore.dispatch(M.notes.addNote(M.withReminder(editStore.getState().notes.items[0], at)));
  const edited = editStore.getState().notes;
  ok(
    "setting only a reminder is a change: a new revision, queued for upload",
    edited.items[0].remindAt === at && edited.items[0].rev > 100 && Object.keys(edited.cloud.items.add).includes("e"),
    edited.items[0]
  );
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
