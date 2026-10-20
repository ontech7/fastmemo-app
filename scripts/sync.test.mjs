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
  "@/libs/vaultSession": `export const isVaultUnlocked = () => true; export const getDEK = () => "k1";`,
  "@/utils/crypt": `export const CryptNote = { encrypt: (note) => ({ ...note, sealed: "outbox" }) };`,
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
      export { noteRev, nextRev } from "@/libs/cloud/revision";
      export { contentToken } from "@/libs/cloud/token";
      export { SyncEngine } from "@/libs/cloud/syncEngine";
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
    return this.online ? this.cloud.snapshot(this.me).devices : null;
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
  subscribeDevices(me, onSnapshot, onError) {
    this.listener = { onSnapshot, onError };
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
      complete: true,
    };
    if (!this.online) return { ...result, complete: false };
    const device = this.cloud.devices.get(me);
    if (!device) return { ...result, complete: false };

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
    timing: { pushMinInterval: 0, ackQuiet: 30, ackMaxWait: 150, ...opts.timing },
    events: {
      onApplied: (e) => {
        events.push(e);
        device.log.push("applied");
      },
      onDevices: () => {},
      onRemoved: () => (device.removed = true),
      onVaultStale: () => (device.stale = true),
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

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
