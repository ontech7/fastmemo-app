// Note store test (ADR-018): the notes stored one value per note, with redux-persist and the real notes slice, on the
// device backend over an in-memory file system that behaves like Android's (scripts/_expo-file-system-legacy-fake.js),
// and on the web backend over an in-memory IndexedDB shared by browser tabs.
// Run: node scripts/note-store.test.mjs
//
// Crashes are simulated by copying the disk at every step of a write (and with the file being written cut in half),
// then launching from each copy: every note must come back as it was before the write or as it is after it.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "note-store.bundle.mjs");

// Modules the slice imports that need a device (or the cloud): replaced by minimal stand-ins.
const STUBS = {
  "@/libs/cloud": `export const only_if_cloudConnected = (cb) => cb(); export const isCloudConnected = () => true; export const cloud = null;`,
  "@/libs/vaultSession": `export const isVaultUnlocked = () => true; export const getDEK = () => "k1";`,
  "@/utils/crypt": `export const CryptNote = { encrypt: (note) => ({ ...note, sealed: "outbox" }) };`,
  "@/configs/default": `export const defaultCategory = { order: 0, name: "All", icon: "none", index: true, selected: true };`,
  "@/constants/icons": `export const CATEGORY_MAP = {};`,
  // The app's note store (the wipe thunk's): each launch here makes its own.
  "@/libs/storage/notes": `export const noteStore = null; export const notesNeedSorting = () => false;`,
  // The web backend's IndexedDB (localforage): the test's in-memory one.
  "@/libs/storage/fsStorage": `export default () => globalThis.__fakeIdb;`,
};

const resolver = {
  name: "fastmemo-test-resolver",
  setup(b) {
    b.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
      path: join(__dirname, "_expo-file-system-legacy-fake.js"),
    }));
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
      export { persistReducer, persistStore } from "redux-persist";
      export * as notes from "@/slicers/notesSlice";
      export { default as notesReducer } from "@/slicers/notesSlice";
      export { createNoteStore } from "@/libs/storage/noteStore";
      export { createNoteStoreBackend } from "@/libs/storage/noteStoreBackend";
      export { createNoteStoreBackend as createWebBackend } from "@/libs/storage/noteStoreBackend.web";
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

const M = await import(pathToFileURL(out).href);
const { notes: N } = M;

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
  }
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------------------------------------------------------ */
/* The disk, the IndexedDB                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

const ROOT = "/data/files";
const FOLDER = `${ROOT}/fastmemo-notes`;
const LEGACY = `${ROOT}/reduxPersist/persist:root_notes`;
const ROOT_BACKUP = `${ROOT}/reduxPersist/backup:root-notes`;

class Disk {
  constructor(from) {
    this.files = new Map(from ? [...from.files].map(([path, file]) => [path, { ...file }]) : []);
    this.dirs = new Set(from ? from.dirs : [ROOT, `${ROOT}/reduxPersist`]);
    this.clock = from ? from.clock : 1;
    this.log = [];
    /** Called around every change: `(when, path, text)`, `when` = "partial" (mid-write) or "after". */
    this.onStep = null;
    /** Makes an operation fail: `(kind, path) => boolean`. */
    this.failOn = null;
  }
  step(kind, path) {
    this.log.push(`${kind} ${path}`);
    if (this.failOn?.(kind, path)) throw new Error(`I/O error: ${kind} ${path}`);
  }
  write(path, text) {
    this.step("write", path);
    this.onStep?.("partial", path, text);
    this.files.set(path, { text, mtime: this.clock++ });
    this.onStep?.("after", path);
  }
  remove(path) {
    this.step("remove", path);
    this.files.delete(path);
    this.onStep?.("after", path);
  }
  rename(from, to) {
    this.step("rename", from);
    const file = this.files.get(from);
    if (!file) throw new Error(`no such file: ${from}`);
    this.files.delete(from);
    this.files.set(to, file);
    this.onStep?.("after", to);
  }
  copy() {
    return new Disk(this);
  }
  /** A copy as if the write of `path` stopped halfway. */
  cutShort(path, text) {
    const copy = this.copy();
    copy.files.set(path, { text: text.slice(0, Math.floor(text.length / 2)), mtime: copy.clock++ });
    return copy;
  }
  entryFiles() {
    return [...this.files.keys()].filter((path) => path.startsWith(`${FOLDER}/`));
  }
  head() {
    return JSON.parse(this.files.get(`${FOLDER}/state.json`).text);
  }
}

/** localforage over an in-memory map, every call asynchronous. */
class Idb {
  constructor(from) {
    this.map = new Map(from?.map);
  }
  copy() {
    return new Idb(this);
  }
  async getItem(key) {
    await new Promise((resolve) => setImmediate(resolve));
    return this.map.has(key) ? this.map.get(key) : null;
  }
  async setItem(key, value) {
    await new Promise((resolve) => setImmediate(resolve));
    this.map.set(key, value);
    return value;
  }
  async removeItem(key) {
    await new Promise((resolve) => setImmediate(resolve));
    this.map.delete(key);
  }
  async keys() {
    await new Promise((resolve) => setImmediate(resolve));
    return [...this.map.keys()];
  }
}

// Web Locks, as the browser has them: one task at a time per name, in the order asked.
{
  const tails = new Map();
  const request = (name, task) => {
    const run = (tails.get(name) ?? Promise.resolve()).then(() => task());
    tails.set(
      name,
      run.catch(() => {})
    );
    return run;
  };
  Object.defineProperty(globalThis.navigator, "locks", { value: { request }, configurable: true });
}

/** redux-persist's layout before the note store: every key's value as JSON. */
const legacyText = (state) =>
  JSON.stringify(Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value)])));

/* ------------------------------------------------------------------------------------------------------------------ */
/* Launching                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

const note = (id, rev, extra = {}) => ({
  id,
  type: "text",
  title: id,
  text: `<div>${id} v${rev}</div>`,
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

const point = (medium) => {
  if (medium instanceof Idb) globalThis.__fakeIdb = medium;
  else globalThis.__fakeDisk = medium;
};

/**
 * Launches the app's notes persistence on `medium` (a Disk: the device backend; an Idb: the web one), as store.ts sets
 * it up. `wrap` changes the backend (to slow it down, say).
 */
const launch = async (medium, { wrap = (backend) => backend } = {}) => {
  point(medium);
  const reports = [];
  let sortNeeded = false;
  let readFailed = false;
  let writeFailed = false;
  const backend = medium instanceof Idb ? M.createWebBackend() : M.createNoteStoreBackend();
  const noteStore = M.createNoteStore(wrap(backend), {
    report: (message) => reports.push(message),
    onSortNeeded: () => {
      sortNeeded = true;
    },
  });
  const storage = {
    getItem: (key) =>
      noteStore.getItem(key).catch((error) => {
        readFailed = true;
        throw error;
      }),
    setItem: (key, value) =>
      readFailed
        ? Promise.resolve()
        : noteStore.setItem(key, value).then(
            () => {
              writeFailed = false;
            },
            (error) => {
              writeFailed = true;
              throw error;
            }
          ),
    removeItem: (key) => noteStore.removeItem(key),
  };
  const reducer = M.persistReducer(
    { key: "root_notes", storage, timeout: 0, serialize: false, deserialize: false, writeFailHandler: () => {} },
    M.notesReducer
  );
  const store = M.configureStore({
    reducer: { notes: reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }),
  });
  const persistor = M.persistStore(store);
  await new Promise((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
  // The write redux-persist makes right after rehydrating, and the cleanup.
  await persistor.flush();
  await sleep(0);
  await persistor.flush();
  return {
    store,
    persistor,
    noteStore,
    reports,
    get sortNeeded() {
      return sortNeeded;
    },
    get readFailed() {
      return readFailed;
    },
    get writeFailed() {
      return writeFailed;
    },
    notes: () => {
      const { _persist, ...rest } = store.getState().notes;
      return rest;
    },
    /** What the wipe thunk does. */
    wipe: async () => {
      point(medium);
      store.dispatch({ type: "notes/wipe" });
      await noteStore.removeCopies();
      await persistor.flush();
    },
    /** Dispatches, and waits for the write (on this launch's medium: a relaunch on a copy points the fake there). */
    dispatch: async (action) => {
      point(medium);
      store.dispatch(action);
      await persistor.flush();
    },
  };
};

/** What a launch shows of the notes: ids and versions per list, and the outbox ids. */
const view = (notes) => ({
  items: notes.items.map((n) => `${n.id}@${n.rev ?? n.updatedAt}`),
  trash: notes.temporaryItems.map((n) => `${n.id}@${n.rev ?? n.updatedAt}`),
  outbox: Object.keys(notes.cloud?.items?.add ?? {}).sort(),
});
const ids = (notes) => ({ items: notes.items.map((n) => n.id), trash: notes.temporaryItems.map((n) => n.id) });

/* ------------------------------------------------------------------------------------------------------------------ */
/* Basics                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nbasics");
{
  const disk = new Disk();
  const app = await launch(disk);
  ok("a fresh install starts empty, and reads fine", app.notes().items.length === 0 && !app.readFailed);

  for (let i = 0; i < 20; i++) await app.dispatch(N.addNote(note(`n${i}`, 100 + i)));
  ok("each note is a file", disk.entryFiles().filter((p) => p.includes("/n_3A")).length === 20, disk.entryFiles());

  const relaunched = await launch(disk.copy());
  ok("a relaunch reads the same notes", same(relaunched.notes(), app.notes()), view(relaunched.notes()));
  ok("...without writing anything", relaunched.reports.length === 0);
}
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 50; i++) await app.dispatch(N.addNote(note(`n${i}`, 100 + i)));
  // Out of the outbox, as after a push: an edit then only rewrites its note (and the outbox's own entry).
  await app.dispatch(N.dropNoteUploads(Object.keys(app.notes().cloud.items.add)));

  disk.log = [];
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "n7"), text: "<div>edited</div>" }));
  const writes = disk.log.filter((line) => line.startsWith("write "));
  ok(
    "an edit writes that note, its outbox entry and the state value, nothing else",
    writes.length === 3 &&
      writes.some((w) => w.includes("n_3An7.json")) &&
      writes.some((w) => w.includes("o_3An7.json")) &&
      writes.some((w) => w.endsWith("/state.json.tmp")),
    writes
  );
  ok(
    "...its outbox entry before the note, the note before the state value",
    writes.findIndex((w) => w.includes("o_3An7")) < writes.findIndex((w) => w.includes("n_3An7")) &&
      writes.findIndex((w) => w.includes("n_3An7")) < writes.findIndex((w) => w.includes("state.json")),
    writes
  );

  disk.log = [];
  await app.dispatch(N.dropNoteUploads(["n7"]));
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "n8"), text: "<div>again</div>" }));
  ok("relaunch after edits: same notes", same((await launch(disk.copy())).notes(), app.notes()));

  await app.dispatch(N.temporaryDeleteNote("n3"));
  let relaunched = await launch(disk.copy());
  ok(
    "a trashed note moves file: in the trash after a relaunch, not among the notes",
    relaunched.notes().temporaryItems.some((n) => n.id === "n3") && !relaunched.notes().items.some((n) => n.id === "n3")
  );
  ok("...and only its trash file is left", disk.entryFiles().filter((p) => /[nt]_3An3\.json$/.test(p)).length === 1);

  await app.dispatch(N.deleteNote("n3"));
  relaunched = await launch(disk.copy());
  ok(
    "a note deleted for good: gone after a relaunch, file removed",
    !relaunched.notes().temporaryItems.some((n) => n.id === "n3") && !disk.entryFiles().some((p) => p.includes("3An3."))
  );
  ok("...and its tombstone kept", relaunched.notes().purged?.n3 !== undefined);
}
{
  const disk = new Disk();
  const app = await launch(disk);
  const long = "L".repeat(300);
  const lone = "bad\uD800id";
  const ids = ["a/b", "100%", "x#2", "é 😀", "__", "n:odd", "con", "..", "q?x", long, lone, `${lone}${long}`];
  for (const [i, id] of ids.entries()) await app.dispatch(N.addNote(note(id, 10 + i)));
  const copy = disk.copy();
  const relaunched = await launch(copy);
  ok(
    "ids with /, %, #, ?, emoji, _, a lone surrogate, 300 characters round-trip",
    same(
      relaunched
        .notes()
        .items.map((n) => n.id)
        .sort(),
      [...ids].sort()
    ),
    relaunched.notes().items.map((n) => n.id)
  );
  ok(
    "...all files in the notes folder (no sub-folder), every name short",
    [...disk.files.keys()].every((p) => !p.includes("/a/b") && p.slice(p.lastIndexOf("/") + 1).length < 200)
  );
  ok("...nothing reported", relaunched.reports.length === 0, relaunched.reports);
  await relaunched.dispatch(N.temporaryDeleteNote(lone));
  await relaunched.dispatch(N.deleteNote(lone));
  const again = await launch(copy.copy());
  ok(
    "...and a note with such an id is deleted like any other",
    !again.notes().items.some((n) => n.id === lone) && again.notes().items.length === ids.length - 1
  );
}
{
  const disk = new Disk();
  const app = await launch(disk);
  await app.dispatch(N.setNotes({ notes: [note("dup", 1, { text: "first" }), note("dup", 2, { text: "second" })] }));
  const relaunched = await launch(disk.copy());
  ok(
    "two notes with the same id each keep their content",
    same(
      relaunched.notes().items.map((n) => n.text),
      app.notes().items.map((n) => n.text)
    ),
    relaunched.notes().items.map((n) => n.text)
  );
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Migration                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nmigration");

const legacyState = (count = 30) => ({
  items: Array.from({ length: count }, (_, i) => note(`old${i}`, 1000 + i)),
  temporaryItems: [note("binned", 50, { deleteDate: 9e12 })],
  temporaryTrashTimespan: 7,
  cloud: { items: { add: { old1: { ...note("old1", 1001), sealed: "outbox" } }, delete: {}, detach: {} } },
  filters: { sortBy: "createdAt", order: "desc" },
  purged: { gone: 5 },
  _persist: { version: -1, rehydrated: true },
});

{
  const disk = new Disk();
  const legacy = legacyState();
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const before = disk.files.get(LEGACY).text;

  const app = await launch(disk);
  const { _persist, ...expected } = legacy;
  ok("the first launch shows the notes stored the old way", same(app.notes(), expected), view(app.notes()));
  ok("...and stores them one per file", disk.entryFiles().filter((p) => /\/[nto]_3A/.test(p)).length === 32);
  ok("...leaving the old value untouched", disk.files.get(LEGACY).text === before);
  const marker = JSON.parse(disk.files.get(`${FOLDER}/migrated.json`)?.text ?? "null");
  ok(
    "...with a marker of the notes it took (id and revision)",
    marker?.notes.length === 31 && marker.notes.some(([id, rev]) => id === "old3" && rev === 1003)
  );
  ok(
    "...written before the state value",
    disk.log.findIndex((l) => l.includes("migrated.json")) < disk.log.findIndex((l) => l.includes("state.json"))
  );

  await app.dispatch(N.addNote(note("new", 5000)));
  const relaunched = await launch(disk.copy());
  ok(
    "the next launch reads the new store (with a note added since)",
    relaunched.notes().items.some((n) => n.id === "new") && relaunched.notes().items.length === 31
  );
  ok("...without touching the old value", relaunched.reports.length === 0 && disk.files.get(LEGACY).text === before);
}
{
  // The first write stopped after some notes.
  const disk = new Disk();
  const legacy = legacyState(10);
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const snapshots = [];
  disk.onStep = (when) => {
    if (when === "after") snapshots.push(disk.copy());
  };
  await launch(disk);
  disk.onStep = null;
  const cut = snapshots.filter((s) => !s.files.has(`${FOLDER}/state.json`) && s.entryFiles().length > 2);
  let allBack = cut.length > 0;
  let outboxKept = true;
  for (const snapshot of cut) {
    const app = await launch(snapshot);
    const { _persist, ...expected } = legacy;
    const v = view(app.notes());
    if (!same([...v.items].sort(), [...view(expected).items].sort()) || !same(v.trash, view(expected).trash)) {
      allBack = false;
      console.error("      lost notes after a first write cut short:", v);
    }
    if (!v.outbox.includes("old1")) outboxKept = false;
    // Without a state value to go by (its spare can be complete: then it's read, in order), the notes are re-sorted.
    const headless = !snapshot.files.has(`${FOLDER}/state.json.tmp`);
    if ((headless && !app.sortNeeded) || app.notes().filters?.sortBy !== "createdAt") allBack = false;
  }
  ok(`a first write cut short (${cut.length} points): every note back, settings from the old value, in order`, allBack);
  ok("...and the old value's outbox kept", outboxKept);
}
{
  // An older version ran again after the migration (a rollback): it rewrote the old value.
  const disk = new Disk();
  const legacy = legacyState(6);
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(N.addNote(note("since", 7000)));
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "old2"), text: "newer here", rev: 8000 }));
  await app.dispatch(N.temporaryDeleteNote("old4"));
  await app.dispatch(N.deleteNote("old4"));
  // A device-only note: no tombstone, only the marker knows it was deleted here.
  await app.dispatch(N.setNotes({ notes: app.notes().items.map((n) => (n.id === "old5" ? { ...n, local: true } : n)) }));
  await app.dispatch(N.temporaryDeleteNote("old5"));
  await app.dispatch(N.deleteNote("old5"));

  const rolledBack = {
    ...legacy,
    items: [
      ...legacy.items.map((n) => (n.id === "old0" ? { ...n, text: "edited in the old version", rev: 9000 } : n)),
      note("madeInOld", 9100),
    ],
  };
  disk.files.set(LEGACY, { text: legacyText(rolledBack), mtime: disk.clock++ });

  const backDisk = disk.copy();
  const back = await launch(backDisk);
  const items = back.notes().items;
  ok(
    "after a rollback: a note made in the older version comes in",
    items.some((n) => n.id === "madeInOld")
  );
  ok(
    "...an edit made there comes in",
    items.find((n) => n.id === "old0")?.text === "edited in the old version" && back.sortNeeded
  );
  ok(
    "...a newer edit made here stays",
    items.find((n) => n.id === "old2")?.text === "newer here" && items.some((n) => n.id === "since")
  );
  ok("...a note deleted for good here doesn't come back", !items.some((n) => n.id === "old4"));
  ok("...nor a device-only note deleted here (no tombstone)", !items.some((n) => n.id === "old5"));

  const again = await launch(backDisk.copy());
  ok("...and it's folded once (the next launch has nothing to fold)", !again.sortNeeded && same(again.notes(), back.notes()));
}
{
  // The root fold (legacyRootNotes.ts) finishing on a later launch: it adds notes to the old value.
  const disk = new Disk();
  const legacy = legacyState(3);
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  await launch(disk);
  disk.files.set(LEGACY, {
    text: legacyText({ ...legacy, items: [...legacy.items, note("fromRoot", 20)] }),
    mtime: disk.clock++,
  });
  const later = await launch(disk.copy());
  ok(
    "notes the root fold adds later come in (whatever their revision)",
    later.notes().items.some((n) => n.id === "fromRoot")
  );
}
{
  // Before any migration, an older app's notes in AsyncStorage: redux-persist's migrate brings them (store.ts).
  const disk = new Disk();
  const app = await launch(disk);
  ok("no old value, no store: empty, nothing reported", app.notes().items.length === 0 && app.reports.length === 0);
}
{
  const disk = new Disk();
  disk.files.set(LEGACY, { text: legacyText(legacyState(3)), mtime: disk.clock++ });
  await launch(disk);
  const head = disk.head();
  ok("the state value records when the notes were migrated", typeof head.migratedAt === "number");

  const fresh = await launch(disk.copy());
  ok("within 14 days the old value stays", fresh.reports.length === 0 && disk.files.has(LEGACY));

  disk.files.get(`${FOLDER}/state.json`).text = JSON.stringify({ ...head, migratedAt: Date.now() - 15 * 86400000 });
  const late = await launch(disk);
  ok(
    "after 14 days it's removed (and its spare), and the state value says so",
    !disk.files.has(LEGACY) && disk.head().migratedAt === undefined && same(late.notes().items.length, 3)
  );
  disk.log = [];
  const next = await launch(disk.copy());
  ok("...once", next.reports.length === 0 && next.notes().items.length === 3);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Crashes                                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\ncrashes");

/** Every point a write of `act` can stop at, launched from: each note as before or after, never lost or mixed. */
const crashCheck = async (label, setup, act, { mayLose = [], mayResurrect = [] } = {}) => {
  const disk = new Disk();
  const app = await launch(disk);
  await setup(app);
  const before = app.notes();
  const snapshots = [];
  disk.onStep = (when, path, text) => {
    snapshots.push(when === "partial" ? disk.cutShort(path, text) : disk.copy());
  };
  await act(app);
  disk.onStep = null;
  const after = app.notes();

  const versions = (notes) => {
    const map = new Map();
    for (const n of notes.items) map.set(n.id, { list: "items", n: JSON.stringify(n) });
    for (const n of notes.temporaryItems) map.set(n.id, { list: "trash", n: JSON.stringify(n) });
    return map;
  };
  const vb = versions(before);
  const va = versions(after);
  let bad = 0;
  for (const snapshot of snapshots) {
    const launched = await launch(snapshot);
    const got = versions(launched.notes());
    const problems = [];
    for (const id of new Set([...vb.keys(), ...va.keys()])) {
      const g = got.get(id);
      const ok1 = g && ((vb.get(id) && same(g, vb.get(id))) || (va.get(id) && same(g, va.get(id))));
      if (g && !ok1) problems.push(`${id}: mixed`);
      if (!g && va.has(id) && vb.has(id)) problems.push(`${id}: lost`);
      if (!g && va.has(id) && !vb.has(id) && !mayLose.includes(id)) problems.push(`${id}: new note lost`);
      if (g && !va.has(id) && !mayResurrect.includes(id) && launched.readFailed) problems.push(`${id}: read failed`);
    }
    for (const id of got.keys()) if (!vb.has(id) && !va.has(id)) problems.push(`${id}: unknown`);
    if (launched.readFailed) problems.push("read failed");
    // A changed note's upload is never dropped: it's in the outbox as before or after.
    for (const id of Object.keys(after.cloud.items.add)) {
      const g = got.get(id);
      if (g && same(g, va.get(id)) && !(id in launched.notes().cloud.items.add)) problems.push(`${id}: upload dropped`);
    }
    // And it settles: a further launch reads the same, nothing left over.
    const settled = await launch(snapshot.copy());
    if (!same(settled.notes(), launched.notes())) problems.push("doesn't settle");
    if (problems.length) {
      bad++;
      if (bad <= 3) console.error("      at", snapshot.log.at(-1) ?? "start", problems);
    }
  }
  ok(`${label}: ${snapshots.length} crash points, every note as before or after`, bad === 0 && snapshots.length > 0);
};

const seed = async (app) => {
  for (let i = 0; i < 6; i++) await app.dispatch(N.addNote(note(`c${i}`, 100 + i)));
  await app.dispatch(N.dropNoteUploads(app.notes().items.map((n) => n.id)));
};

await crashCheck("an edit", seed, (app) =>
  app.dispatch(N.addNote({ ...app.notes().items[2], text: "<div>changed</div>", rev: 999 }))
);
await crashCheck("a new note", seed, (app) => app.dispatch(N.addNote(note("fresh", 500))), { mayLose: ["fresh"] });
await crashCheck("to the trash", seed, (app) => app.dispatch(N.temporaryDeleteNote("c1")));
await crashCheck(
  "deleted for good",
  async (app) => {
    await seed(app);
    await app.dispatch(N.temporaryDeleteNote("c4"));
  },
  (app) => app.dispatch(N.deleteNote("c4")),
  { mayResurrect: ["c4"] }
);
await crashCheck("several at once", seed, async (app) => {
  await app.dispatch(N.toggleImportantNotes(["c0|false", "c3|false", "c5|false"]));
});

{
  // An edit's outbox entry stored, the state value not yet: it's taken back at launch.
  const disk = new Disk();
  const app = await launch(disk);
  await seed(app);
  let atOutbox;
  disk.onStep = (when, path) => {
    if (when === "after" && path.endsWith("/o_3Ac2.json")) atOutbox = disk.copy();
  };
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "c2"), text: "<div>changed</div>" }));
  disk.onStep = null;
  const back = await launch(atOutbox);
  ok("an outbox entry the state value doesn't list yet is taken back", "c2" in back.notes().cloud.items.add);
  ok("...and listed from then on", disk.head().outbox.includes("c2") && atOutbox.head().outbox.includes("c2"));

  // An upload done (the note marked synced), the outbox entry not removed yet: it's a leftover.
  const pushed = disk.copy();
  const head = pushed.head();
  pushed.files.get(`${FOLDER}/state.json`).text = JSON.stringify({ ...head, outbox: head.outbox.filter((id) => id !== "c2") });
  const c2 = JSON.parse(pushed.files.get(`${FOLDER}/n_3Ac2.json`).text);
  pushed.files.get(`${FOLDER}/n_3Ac2.json`).text = JSON.stringify({ ...c2, syncedRev: c2.rev });
  const after = await launch(pushed);
  ok(
    "an outbox entry of a note the cloud has is not taken back, and removed",
    !("c2" in after.notes().cloud.items.add) && !pushed.files.has(`${FOLDER}/o_3Ac2.json`)
  );
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Damage                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\ndamage");
{
  const disk = new Disk();
  const legacy = legacyState(4);
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(N.addNote(note("onlyHere", 3000)));
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "old1"), text: "newer", rev: 3001 }));

  const broken = disk.copy();
  broken.files.get(`${FOLDER}/n_3Aold1.json`).text = '{"id":"old1","te';
  broken.files.get(`${FOLDER}/n_3AonlyHere.json`).text = "";
  broken.files.delete(`${FOLDER}/n_3Aold2.json`);
  const hurt = await launch(broken);
  const items = hurt.notes().items;
  ok(
    "an unreadable note comes from the old value (an older version beats none)",
    items.find((n) => n.id === "old1")?.rev === 1001
  );
  ok(
    "a missing note too",
    items.some((n) => n.id === "old2")
  );
  ok(
    "a note only this store had is given up, and reported (once, with a count)",
    !items.some((n) => n.id === "onlyHere") && hurt.reports.filter((r) => r.includes("lost")).length === 1,
    hurt.reports
  );
  ok(
    "the unreadable files are set aside, not deleted",
    [...broken.files.keys()].some((p) => p.includes(".corrupt-"))
  );
  ok("everything else reads", items.length === 4 && !hurt.readFailed, view(hurt.notes()));
  const after = await launch(broken.copy());
  ok("...and the next launch is clean", after.reports.length === 0 && same(after.notes(), hurt.notes()));
}
{
  // A lost note whose id ends in `#<digits>`: its own legacy copy, not the one without the ending.
  const disk = new Disk();
  disk.files.set(LEGACY, {
    text: legacyText({ ...legacyState(0), items: [note("x", 1, { text: "x" }), note("x#2", 2, { text: "x#2" })] }),
    mtime: disk.clock++,
  });
  await launch(disk);
  disk.files.delete(`${FOLDER}/n_3Ax_232.json`);
  const hurt = await launch(disk.copy());
  ok("a lost note named like a duplicate comes back as itself", hurt.notes().items.find((n) => n.id === "x#2")?.text === "x#2");
}
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 5; i++) await app.dispatch(N.addNote(note(`h${i}`, 10 + i)));
  await app.dispatch(N.setNoteFilters({ sortBy: "title", order: "asc" }));
  const broken = disk.copy();
  broken.files.get(`${FOLDER}/state.json`).text = "{ not json";
  const hurt = await launch(broken);
  ok("an unreadable state value: rebuilt from the notes", hurt.notes().items.length === 5 && hurt.sortNeeded);
  ok("...reported, not a failed read", hurt.reports.length > 0 && !hurt.readFailed);
  ok("...with the uploads still waiting", Object.keys(hurt.notes().cloud.items.add).length === 5);
}
{
  // A lost state value after the migration, with the legacy value still there.
  const disk = new Disk();
  const legacy = {
    ...legacyState(0),
    items: [note("L1", 1, { local: true }), note("L2", 2), note("L3", 3)],
    cloud: { items: { add: {}, delete: { stale: { id: "stale", rev: 1 } }, detach: {} } },
  };
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(
    N.applyNotesPlan({
      put: [],
      trash: [],
      detach: [],
      synced: {},
      dropUploads: [],
      dropDeletes: ["stale"],
      upload: [],
      sendDeletes: [],
      sendStubs: [],
      changed: [],
      conflicts: [],
    })
  );
  await app.dispatch(N.temporaryDeleteNote("L2"));
  await app.dispatch(N.deleteNote("L2"));
  await app.dispatch(N.setNoteFilters({ sortBy: "title", order: "asc" }));
  ok("(set-up: the old deletion went out, L2 deleted)", !("stale" in app.notes().cloud.items.delete) && app.notes().purged?.L2);

  const broken = disk.copy();
  broken.files.get(`${FOLDER}/state.json`).text = "";
  const rebuilt = await launch(broken);
  ok(
    "rebuilt: a note deleted for good since the migration doesn't come back",
    same(ids(rebuilt.notes()).items.sort(), ["L1", "L3"]),
    ids(rebuilt.notes())
  );
  ok("...the old value's deletions aren't sent again", !("stale" in (rebuilt.notes().cloud?.items.delete ?? {})));
  ok(
    "...its settings and tombstones taken",
    rebuilt.notes().filters?.sortBy === "createdAt" && rebuilt.notes().purged?.gone === 5
  );

  ok("...the old value's stamp recorded, so it isn't folded again", broken.head().legacy !== null);
  await rebuilt.dispatch(N.temporaryDeleteNote("L1"));
  await rebuilt.dispatch(N.deleteNote("L1"));
  const next = await launch(broken.copy());
  ok(
    "...and a device-only note deleted after the rebuild stays deleted (nothing folded again)",
    same(ids(next.notes()).items, ["L3"]) && next.reports.length === 0,
    { notes: ids(next.notes()), reports: next.reports }
  );
}
{
  // Everything deleted, then the state value lost: the notes don't come back as if never migrated.
  const disk = new Disk();
  disk.files.set(LEGACY, { text: legacyText(legacyState(3)), mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(N.setNotes({ notes: [] }));
  await app.dispatch(N.deleteAllNotes());
  await app.dispatch(N.dropNoteUploads(["old1"]));
  ok("(set-up: no entries left)", !disk.entryFiles().some((p) => /\/[nto]_3A/.test(p)), disk.entryFiles());
  const broken = disk.copy();
  broken.files.delete(`${FOLDER}/state.json`);
  const after = await launch(broken);
  ok(
    "no notes and a lost state value: still no notes (the marker says it was migrated)",
    after.notes().items.length === 0 && after.notes().temporaryItems.length === 0,
    ids(after.notes())
  );
}
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 3; i++) await app.dispatch(N.addNote(note(`f${i}`, 10 + i)));
  const failing = disk.copy();
  failing.failOn = (kind, path) => kind === "read" && path.endsWith("f1.json");
  const hurt = await launch(failing);
  ok("a read that fails (I/O): the whole read fails, nothing is written", hurt.readFailed && hurt.notes().items.length === 0);
  failing.failOn = null;
  ok("...and the notes are all still there", (await launch(failing.copy())).notes().items.length === 3);
}
{
  const disk = new Disk();
  const app = await launch(disk);
  await app.dispatch(N.addNote(note("x", 1)));
  const newer = disk.copy();
  newer.files.get(`${FOLDER}/state.json`).text = JSON.stringify({ ...disk.head(), format: 2 });
  const old = await launch(newer);
  ok("a store written by a newer version: not read, not written over", old.readFailed);
  ok("...its files untouched", newer.files.get(`${FOLDER}/n_3Ax.json`) !== undefined);
  const reshaped = disk.copy();
  reshaped.files.get(`${FOLDER}/state.json`).text = JSON.stringify({ format: 2, notes: {} });
  ok("...even when its state value has another shape", (await launch(reshaped)).readFailed);
}
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 4; i++) await app.dispatch(N.addNote(note(`w${i}`, 10 + i)));
  disk.failOn = (kind, path) => kind === "write" && path.includes("w2");
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "w2"), text: "won't fit", rev: 99 }));
  ok("a write that fails is reported to the app (not persisted)", app.writeFailed);
  disk.failOn = null;
  await app.dispatch(N.addNote(note("w9", 50)));
  ok("...the next write catches up", !app.writeFailed);
  const relaunched = await launch(disk.copy());
  ok(
    "...nothing lost",
    relaunched.notes().items.find((n) => n.id === "w2")?.text === "won't fit" && relaunched.notes().items.length === 5
  );
}
{
  const disk = new Disk();
  const app = await launch(disk);
  await app.dispatch(N.addNote(note("keep", 1)));
  disk.files.set(`${FOLDER}/n_3Astray.json`, { text: JSON.stringify(note("stray", 1)), mtime: 1 });
  disk.files.set(`${FOLDER}/t_3Aspare.json.tmp`, { text: "{}", mtime: 1 });
  const relaunched = await launch(disk);
  ok("leftovers nothing lists are removed on launch, not read", !relaunched.notes().items.some((n) => n.id === "stray"));
  ok("...files gone", !disk.files.has(`${FOLDER}/n_3Astray.json`) && !disk.files.has(`${FOLDER}/t_3Aspare.json.tmp`));
  ok("...listed notes kept", disk.files.has(`${FOLDER}/n_3Akeep.json`));
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Wiping                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nwiping");
{
  const disk = new Disk();
  disk.files.set(LEGACY, { text: legacyText(legacyState(3)), mtime: disk.clock++ });
  disk.files.set(`${LEGACY}.tmp`, { text: legacyText(legacyState(3)), mtime: disk.clock++ });
  disk.files.set(ROOT_BACKUP, { text: "[]", mtime: disk.clock++ });
  disk.files.set(`${LEGACY}.corrupt-1`, { text: "x", mtime: disk.clock++ });
  disk.files.set(`${ROOT}/reduxPersist/fastmemo:root-notes-folded`, { text: "1", mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(N.addNote({ ...app.notes().items[0], text: "<div>edited</div>" }));
  const broken = disk.copy();
  broken.files.get(`${FOLDER}/n_3Aold1.json`).text = "{";
  const hurt = await launch(broken);
  ok(
    "(set-up: a value set aside)",
    [...broken.files.keys()].some((p) => p.includes(".corrupt-"))
  );

  await hurt.wipe();
  ok(
    "wiping: the old value, its spare, the root backup and set-aside copies are gone",
    [...broken.files.keys()].every(
      (p) => ![LEGACY, `${LEGACY}.tmp`, ROOT_BACKUP, `${LEGACY}.corrupt-1`].includes(p) && !p.includes(".corrupt-")
    ),
    [...broken.files.keys()]
  );
  ok("...other values kept", broken.files.has(`${ROOT}/reduxPersist/fastmemo:root-notes-folded`));
  ok("...no note file left, uploads included", !broken.entryFiles().some((p) => /\/[nto]_3A/.test(p)), broken.entryFiles());
  const relaunched = await launch(broken.copy());
  ok("...nothing comes back on the next launch", relaunched.notes().items.length === 0 && relaunched.reports.length === 0);
  const lost = broken.copy();
  lost.files.delete(`${FOLDER}/state.json`);
  ok("...nor with a lost state value", (await launch(lost)).notes().items.length === 0);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Writes                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nwrites");
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 400; i++) await app.dispatch(N.addNote(note(`p${i}`, 10 + i, { text: "x".repeat(6000) })));
  await app.dispatch(N.dropNoteUploads(app.notes().items.map((n) => n.id)));
  disk.log = [];
  point(disk);
  for (let k = 0; k < 30; k++) {
    app.store.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "p5"), text: `typing ${k}` }));
  }
  await app.persistor.flush();
  const writes = disk.log.filter((l) => l.startsWith("write "));
  const bytes = writes.reduce((sum, w) => sum + (disk.files.get(w.slice(6).replace(/\.tmp$/, ""))?.text.length ?? 0), 0);
  ok(
    `30 quick edits of one note among 400 (2.4MB): ${writes.length} writes, ~${Math.round(bytes / 1024)}KB`,
    bytes < 200_000,
    writes.length
  );
  const relaunched = await launch(disk.copy());
  ok("...the last edit is what's stored", relaunched.notes().items.find((n) => n.id === "p5")?.text === "typing 29");
}
{
  // A write that a newer one supersedes while it waits: its flush resolves only once that one is stored.
  const disk = new Disk();
  let failWrites = false;
  const slow = (backend) => ({
    ...backend,
    write: async (name, value) => {
      await sleep(15);
      if (failWrites && name === "state") throw new Error("disk full");
      return backend.write(name, value);
    },
  });
  const app = await launch(disk, { wrap: slow });
  for (let i = 0; i < 3; i++) await app.dispatch(N.addNote(note(`s${i}`, 10 + i)));
  point(disk);
  app.store.dispatch(N.addNote({ ...app.notes().items[0], text: "w0" }));
  await sleep(5); // the edit's write starts
  app.store.dispatch(N.addNote(note("applied", 99)));
  const flush = app.persistor.flush(); // the sync engine's flush after applying a change
  app.store.dispatch(N.addNote({ ...app.notes().items[1], text: "b" }));
  await sleep(1); // and another change: its write supersedes the flushed one
  await flush;
  ok(
    "a superseded write's flush waits for the write that superseded it",
    disk.files.has(`${FOLDER}/n_3Aapplied.json`) && disk.head().items.includes("n:applied")
  );

  failWrites = true;
  app.store.dispatch(N.addNote({ ...app.notes().items[0], text: "w1" }));
  await sleep(5);
  app.store.dispatch(N.addNote(note("applied2", 98)));
  const failing = app.persistor.flush();
  app.store.dispatch(N.addNote({ ...app.notes().items[1], text: "c" }));
  await sleep(1);
  await failing;
  ok("...and fails with it (the app knows the notes aren't stored)", app.writeFailed);
  failWrites = false;
  await sleep(100);
}
{
  // The migration of many notes: written a few at a time, never more at once.
  const disk = new Disk();
  disk.files.set(LEGACY, { text: legacyText(legacyState(200)), mtime: disk.clock++ });
  let running = 0;
  let most = 0;
  const counting = (backend) => ({
    ...backend,
    write: async (name, value) => {
      running++;
      most = Math.max(most, running);
      try {
        return await backend.write(name, value);
      } finally {
        running--;
      }
    },
  });
  const app = await launch(disk, { wrap: counting });
  ok(`a bulk write runs a few writes at a time (at most ${most})`, most > 1 && most <= 8 && app.notes().items.length === 200);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Web: IndexedDB, browser tabs                                                                                        */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nweb");
{
  const idb = new Idb();
  const legacy = legacyState(5);
  idb.map.set("persist:root_notes", legacyText(legacy));
  idb.map.set("backup:root-notes", "[]");
  const app = await launch(idb);
  ok(
    "migrates the IndexedDB value: one value per note, a marker, the old value kept",
    app.notes().items.length === 5 &&
      idb.map.has("v2:n:old3") &&
      idb.map.has("v2:migrated") &&
      idb.map.has("v2:state") &&
      idb.map.has("persist:root_notes")
  );
  const relaunched = await launch(idb);
  await relaunched.dispatch(N.addNote({ ...relaunched.notes().items.find((n) => n.id === "old2"), text: "edited" }));
  const again = await launch(idb.copy());
  ok("an edit is stored, a relaunch reads it", again.notes().items.find((n) => n.id === "old2")?.text === "edited");

  idb.map.set("corrupt:5:n:x", "{");
  await relaunched.wipe();
  ok(
    "wiping removes the old value, the root backup and set-aside values",
    !idb.map.has("persist:root_notes") && !idb.map.has("backup:root-notes") && !idb.map.has("corrupt:5:n:x"),
    [...idb.map.keys()]
  );
  ok("...and every note", ![...idb.map.keys()].some((key) => /^v2:[nto]:/.test(key)), [...idb.map.keys()]);
}
{
  // Two tabs, each with its own copy of the notes: one trashes a note, then the other (stale) saves a change.
  const idb = new Idb();
  const first = await launch(idb);
  await first.dispatch(N.addNote(note("A", 10)));
  await first.dispatch(N.addNote(note("W", 11)));
  const tab1 = await launch(idb);
  const tab2 = await launch(idb);
  await tab2.dispatch(N.temporaryDeleteNote("W"));
  await tab1.dispatch(N.addNote(note("X", 50)));
  const next = await launch(idb.copy());
  ok(
    "two tabs: a stale tab's save after the other trashed a note keeps the note (the last save wins, whole)",
    same(ids(next.notes()), ids(tab1.notes())) && next.reports.length === 0,
    { got: ids(next.notes()), reports: next.reports }
  );

  await tab2.dispatch(N.restoreNote({ id: "W", categories: [] }));
  await tab1.dispatch(N.addNote(note("Y", 60)));
  const after = await launch(idb.copy());
  ok(
    "...and after the other restored it from the trash",
    after.notes().items.some((n) => n.id === "W") || after.notes().temporaryItems.some((n) => n.id === "W"),
    { got: ids(after.notes()), reports: after.reports }
  );
  ok("...nothing reported lost", after.reports.length === 0, after.reports);
}
{
  // A tab launching while another one saves: it reads before or after that save, never in the middle.
  const idb = new Idb();
  const tab1 = await launch(idb);
  for (let i = 0; i < 20; i++) await tab1.dispatch(N.addNote(note(`m${i}`, 10 + i)));
  point(idb);
  tab1.store.dispatch(N.temporaryDeleteNotes?.(["m3|false", "m4|false"]) ?? N.temporaryDeleteNote("m3"));
  const saving = tab1.persistor.flush();
  const tab2 = await launch(idb);
  await saving;
  ok(
    "a tab launching during another's save reads it whole",
    tab2.reports.length === 0 && tab2.notes().items.length + tab2.notes().temporaryItems.length === 20,
    tab2.reports
  );
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
