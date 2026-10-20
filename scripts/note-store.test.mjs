// Note store test (ADR-018): the notes stored one value per note, on the device backend over an in-memory file
// system that behaves like Android's (scripts/_expo-file-system-fake.js), with redux-persist and the real notes slice.
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
      export { persistReducer, persistStore } from "redux-persist";
      export * as notes from "@/slicers/notesSlice";
      export { default as notesReducer } from "@/slicers/notesSlice";
      export { createNoteStore } from "@/libs/storage/noteStore";
      export { createNoteStoreBackend } from "@/libs/storage/noteStoreBackend";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src, "expo-file-system": join(__dirname, "_expo-file-system-fake.js") },
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

/* ------------------------------------------------------------------------------------------------------------------ */
/* The disk                                                                                                            */
/* ------------------------------------------------------------------------------------------------------------------ */

const ROOT = "/data/files";
const FOLDER = `${ROOT}/fastmemo-notes`;
const LEGACY = `${ROOT}/reduxPersist/persist:root_notes`;

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
  writes() {
    return this.log.filter((line) => line.startsWith("write ")).length;
  }
  entryFiles() {
    return [...this.files.keys()].filter((path) => path.startsWith(`${FOLDER}/`));
  }
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

/** Launches the app's notes persistence on `disk`: the note store under redux-persist, as store.ts sets it up. */
const launch = async (disk) => {
  globalThis.__fakeDisk = disk;
  const reports = [];
  let sortNeeded = false;
  let readFailed = false;
  let writeFailed = false;
  const noteStore = M.createNoteStore(M.createNoteStoreBackend(), {
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
  await new Promise((resolve) => setTimeout(resolve, 0));
  await persistor.flush();
  return {
    store,
    persistor,
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
    /** Dispatches, and waits for the write (on this launch's disk: a relaunch on a copy points the fake there). */
    dispatch: async (action) => {
      globalThis.__fakeDisk = disk;
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
  const ids = ["a/b", "100%", "x#2", "é 😀", "__", "n:odd", "con", ".."];
  for (const [i, id] of ids.entries()) await app.dispatch(N.addNote(note(id, 10 + i)));
  const relaunched = await launch(disk.copy());
  ok(
    "ids with /, %, #, emoji, _ round-trip",
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
    "...all files in the notes folder (no sub-folder)",
    [...disk.files.keys()].every((p) => !p.includes("/a/b"))
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

  await app.dispatch(N.addNote(note("new", 5000)));
  const relaunched = await launch(disk.copy());
  ok(
    "the next launch reads the new store (with a note added since)",
    relaunched.notes().items.some((n) => n.id === "new") && relaunched.notes().items.length === 31
  );
  ok("...without touching the old value", relaunched.reports.length === 0 && disk.files.get(LEGACY).text === before);
}
{
  // The first write stopped after some notes: no state value yet.
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
  for (const snapshot of cut) {
    const app = await launch(snapshot);
    const { _persist, ...expected } = legacy;
    const v = view(app.notes());
    if (!same([...v.items].sort(), [...view(expected).items].sort()) || !same(v.trash, view(expected).trash)) {
      allBack = false;
      console.error("      lost notes after a first write cut short:", v);
    }
    // Without a state value to go by (its spare can be complete: then it's read, in order), the notes are re-sorted.
    const headless = !snapshot.files.has(`${FOLDER}/state.json.tmp`);
    if ((headless && !app.sortNeeded) || app.notes().filters?.sortBy !== "createdAt") allBack = false;
  }
  ok(`a first write cut short (${cut.length} points): every note back, settings from the old value, in order`, allBack);
}
{
  // An older version ran again after the migration (a rollback): it rewrote the old value.
  const disk = new Disk();
  const legacy = legacyState(5);
  disk.files.set(LEGACY, { text: legacyText(legacy), mtime: disk.clock++ });
  const app = await launch(disk);
  await app.dispatch(N.addNote(note("since", 7000)));
  await app.dispatch(N.addNote({ ...app.notes().items.find((n) => n.id === "old2"), text: "newer here", rev: 8000 }));
  await app.dispatch(N.temporaryDeleteNote("old4"));
  await app.dispatch(N.deleteNote("old4"));

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

  const again = await launch(backDisk.copy());
  ok("...and it's folded once (the next launch has nothing to fold)", !again.sortNeeded && same(again.notes(), back.notes()));
}
{
  // Before any migration, an older app's notes in AsyncStorage: redux-persist's migrate brings them (store.ts).
  const disk = new Disk();
  const app = await launch(disk);
  ok("no old value, no store: empty, nothing reported", app.notes().items.length === 0 && app.reports.length === 0);
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
    "a note only this store had is given up, and reported",
    !items.some((n) => n.id === "onlyHere") && hurt.reports.some((r) => r.includes("lost"))
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
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 5; i++) await app.dispatch(N.addNote(note(`h${i}`, 10 + i)));
  await app.dispatch(N.setNoteFilters({ sortBy: "title", order: "asc" }));
  const broken = disk.copy();
  broken.files.get(`${FOLDER}/state.json`).text = "{ not json";
  const hurt = await launch(broken);
  ok("an unreadable state value: rebuilt from the notes", hurt.notes().items.length === 5 && hurt.sortNeeded);
  ok("...reported, not a failed read", hurt.reports.length > 0 && !hurt.readFailed);
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
  const head = JSON.parse(newer.files.get(`${FOLDER}/state.json`).text);
  newer.files.get(`${FOLDER}/state.json`).text = JSON.stringify({ ...head, format: 2 });
  const old = await launch(newer);
  ok("a store written by a newer version: not read, not written over", old.readFailed);
  ok("...its files untouched", newer.files.get(`${FOLDER}/n_3Ax.json`) !== undefined);
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
/* Writes                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nwrites");
{
  const disk = new Disk();
  const app = await launch(disk);
  for (let i = 0; i < 400; i++) await app.dispatch(N.addNote(note(`p${i}`, 10 + i, { text: "x".repeat(6000) })));
  await app.dispatch(N.dropNoteUploads(app.notes().items.map((n) => n.id)));
  disk.log = [];
  globalThis.__fakeDisk = disk;
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

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
