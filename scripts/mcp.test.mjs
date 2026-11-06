// The local MCP server's page side: what an agent may reach, and how each tool answers. This filter is the only barrier
// protecting locked and hidden notes (locked is a flag the UI enforces, not encryption), so it's tested through the tools.
// Run: node scripts/mcp.test.mjs
// It bundles the handlers and the bridge with the real notes, categories and settings slices (native-only imports stubbed).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "mcp.bundle.mjs");

// Modules that need a device, the cloud or the Tauri shell: replaced by minimal stand-ins.
const STUBS = {
  "@/libs/cloud": `export const only_if_cloudConnected = (cb) => cb(); export const isCloudConnected = () => false; export const cloud = null; export const noteTextLimit = () => 1000;`,
  "@/libs/storage/notes": `export const noteStore = null; export const notesNeedSorting = () => false;`,
  "@/libs/vaultSession": `export const isVaultUnlocked = () => true; export const getDEK = () => "k1";`,
  "@/utils/crypt": `export const CryptNote = { encrypt: (note) => ({ ...note, sealed: "outbox" }) };`,
  "@/configs/default": `export const defaultCategory = { order: 0, name: "All", icon: "none", index: true, selected: true };`,
  "@/constants/icons": `export const CATEGORY_MAP = {};`,
  // What the bridge reads from the app's store and the page: the test's `globalThis.__page`. helpers.ts (for stripHtml)
  // imports the store too.
  "@/slicers/store": `
    export const store = { getState: () => globalThis.__page.getState(), dispatch: (action) => globalThis.__page.dispatch(action) };
    export const persistor = { getState: () => ({ bootstrapped: globalThis.__page.bootstrapped }) };
    export const notesLoaded = () => globalThis.__page.notesLoaded;
    export const notesPersisted = () => true;
  `,
  "@/libs/cloud/sync": `export const notifyNoteChanged = () => {};`,
  "@/libs/flushOnExit": `export const flushNow = () => Promise.resolve();`,
  "@/libs/net": `export const postWebhook = async () => {};`,
  "@/utils/date": `export const formatDateTime = () => "today";`,
  "@/utils/platform": `export const isTauri = () => globalThis.__page.tauri;`,
  "@tauri-apps/api/event": `export const listen = async (name, handler) => {
    globalThis.__page.listeners[name] = handler;
    globalThis.__page.listens = (globalThis.__page.listens ?? 0) + 1;
    return () => { globalThis.__page.unlistened = (globalThis.__page.unlistened ?? 0) + 1; };
  };`,
  "@tauri-apps/api/core": `export const invoke = async (command, args) => { globalThis.__page.invoked.push({ command, args }); };`,
  // The update check and the help texts: what the page's i18n and the Tauri app API would answer.
  "@tauri-apps/api/app": `
    export const BundleType = { Deb: "deb", Rpm: "rpm", AppImage: "appimage" };
    export const getVersion = async () => globalThis.__page.version;
    export const getBundleType = async () => globalThis.__page.bundleType;
  `,
  "@/libs/desktopUpdater": `export const checkDesktopUpdate = async () => globalThis.__page.checkDesktopUpdate();`,
  "@/libs/i18n": `export default { t: (key, options) => globalThis.__page.t(key, options) };`,
  "react-native": `export const Platform = { OS: "web", select: (options) => options.web ?? options.default };`,
};

const resolver = {
  name: "fastmemo-test-resolver",
  setup(b) {
    b.onResolve({ filter: /^(@\/|@tauri-apps\/|react-native$)/ }, (args) => {
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
      export * as settings from "@/slicers/settingsSlice";
      export { default as settingsReducer } from "@/slicers/settingsSlice";
      export { handleMcpRequest } from "@/libs/mcp/handlers";
      export * as policy from "@/libs/mcp/policy";
      export * as view from "@/libs/mcp/noteView";
      export * as input from "@/libs/mcp/noteInput";
      export * as editing from "@/libs/mcp/noteEdit";
      export { KANBAN_COLUMN_COLORS } from "@/constants/styles";
      export { installMcpBridge } from "@/libs/mcp/bridge.web";
      export { HELP_TOPICS, HELP_MOBILE_ONLY } from "@/constants/help-topics";
      export { helpText } from "@/libs/mcp/help";
      export { default as en } from "@/libs/i18n/locales/en";
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
const { notes: N, categories: C, settings: S, policy: P, view: V, input: I } = M;
const { NOT_FOUND } = P;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (cond, ms = 2000) => {
  const deadline = Date.now() + ms;
  while (!cond() && Date.now() < deadline) await sleep(5);
  return cond();
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* What the tests run on: real reducers holding the notes, fake deps for the rest                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

const ALL = { order: 0, name: "All", icon: "none", index: true, selected: true };

const textNote = (id, updatedAt, extra = {}) => ({
  id,
  type: "text",
  title: `title of ${id}`,
  text: `<p>body of ${id}</p>`,
  category: ALL,
  date: "",
  createdAt: 1,
  updatedAt,
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
  ...extra,
});

const IMAGE_DATA = "data:image/png;base64,QUJDREVGRw==";

const SEED = [
  textNote("open", 100),
  textNote("lockedNote", 900, { locked: true, title: "SECRETWORD", text: "<p>SECRETBODY</p>" }),
  textNote("hiddenNote", 800, { hidden: true, title: "HIDDENTITLE", text: "<p>HIDDENWORD</p>" }),
  textNote("ro", 200, {
    readOnly: true,
    important: true,
    category: { ...ALL, order: 1, name: "Work", icon: "work", index: false },
  }),
  textNote("gone", 700, { text: "<p>TRASHWORD</p>" }),
  textNote("pic", 300, {
    text: `<p><strong>before</strong></p><img src="${IMAGE_DATA}" alt="a>b" style="width:50%"><p>after</p><img src='${IMAGE_DATA}'>`,
  }),
  {
    ...textNote("todo", 400),
    type: "todo",
    text: undefined,
    list: [
      { id: "i1", text: "buy MILK", checked: false },
      { id: "i2", text: "call Anna", checked: true },
    ],
  },
  {
    ...textNote("board", 500),
    type: "kanban",
    text: undefined,
    columns: [{ id: "c1", name: "BACKLOG", color: "#fff", items: [{ id: "k1", text: "write TESTS" }] }],
  },
  {
    ...textNote("snippet", 600),
    type: "code",
    text: undefined,
    tabs: [{ id: "t1", title: "main.rs", code: "fn HELLO() {}", language: "rust" }],
    activeTabId: "t1",
  },
];

/** A store with these notes in it, through the real reducers. `gone` goes to the trash as the app would send it there. */
const makeStore = (notes = SEED) => {
  const store = M.configureStore({
    reducer: { notes: M.notesReducer, categories: M.categoriesReducer, settings: M.settingsReducer },
    middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
  });
  notes.forEach((note) => store.dispatch(N.addNote(note)));
  if (notes.some((note) => note.id === "gone")) store.dispatch(N.temporaryDeleteNote("gone"));
  return store;
};

const notBuilt = () => {
  throw new Error("not used by these tools");
};

const harness = (notes = SEED, overrides = {}) => {
  const store = makeStore(notes);
  const log = { commits: 0, dispatched: [], order: [] };
  const deps = {
    getState: store.getState,
    dispatch: (action) => {
      log.dispatched.push(action);
      log.order.push("dispatch");
      store.dispatch(action);
    },
    commitPending: () => {
      log.commits++;
    },
    flush: async () => {
      // A real wait: a handler that doesn't await the flush answers before this logs.
      await sleep(5);
      log.order.push("flush");
    },
    ready: () => true,
    persisted: () => true,
    sanitize: notBuilt,
    textLimit: () => 1000,
    sendWebhook: notBuilt,
    notifyNoteChanged: notBuilt,
    newId: () => "new-id",
    now: () => 1000,
    date: () => "today",
    checkUpdate: notBuilt,
    helpBody: notBuilt,
    helpTitle: notBuilt,
    ...overrides,
  };
  const call = (tool, args = {}, scope = { editAll: false, ownedIds: [] }) =>
    M.handleMcpRequest({ id: 1, tool, args, scope }, deps);
  return {
    store,
    log,
    call,
    read: (id, offset) => call("fastmemo_read_note", { id, ...(offset !== undefined && { offset }) }),
    search: (query, more = {}) => call("fastmemo_search_notes", { ...(query !== undefined && { query }), ...more }),
    categories: () => call("fastmemo_list_categories"),
  };
};

const found = (reply) => JSON.parse(reply.text).notes;
const ids = (reply) => found(reply).map((note) => note.id);
const page = (reply) => JSON.parse(reply.text);

/* ------------------------------------------------------------------------------------------------------------------ */
/* The filter                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nthe filter");

{
  const { isVisibleToAgent, findVisibleNote } = P;
  const plain = textNote("a", 1);
  ok("a plain note is visible", isVisibleToAgent(plain));
  ok("a read-only note is visible", isVisibleToAgent({ ...plain, readOnly: true }));
  ok("a locked note isn't", !isVisibleToAgent({ ...plain, locked: true }));
  ok("a hidden note isn't", !isVisibleToAgent({ ...plain, hidden: true }));

  const items = [plain, textNote("l", 1, { locked: true }), textNote("h", 1, { hidden: true })];
  ok("found by id", findVisibleNote(items, "a") === plain);
  ok("locked: not found", findVisibleNote(items, "l") === undefined);
  ok("hidden: not found", findVisibleNote(items, "h") === undefined);
  ok("unknown: not found", findVisibleNote(items, "nope") === undefined);
  ok(
    "an id that isn't a string: not found",
    [undefined, null, 0, {}, ["a"]].every((id) => findVisibleNote(items, id) === undefined)
  );
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* read_note                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nread_note");

{
  const { read, store } = harness();
  const madeUp = await read("made-up");
  const locked = await read("lockedNote");

  ok("a made-up id is an error saying no such note", madeUp.isError && madeUp.text === NOT_FOUND);
  ok("locked = unknown", locked.text === madeUp.text && locked.isError);
  ok("hidden = unknown", (await read("hiddenNote")).text === NOT_FOUND && (await read("hiddenNote")).isError);
  ok("trashed = unknown", (await read("gone")).text === NOT_FOUND && (await read("gone")).isError);
  ok("no id = unknown", (await read(undefined)).text === NOT_FOUND);

  store.dispatch(S.setShowHidden(true));
  ok("hidden = unknown, even with show hidden on", (await read("hiddenNote")).text === NOT_FOUND);
  store.dispatch(S.setShowHidden(false));

  const view = JSON.parse((await read("open")).text);
  ok("a plain note reads", view.content === "<p>body of open</p>" && view.title === "title of open" && view.type === "text");
  ok("with its revision", view.rev === store.getState().notes.items.find((n) => n.id === "open").rev && view.rev > 0);
  ok("read-only notes can be read", !(await read("ro")).isError);
  const ro = JSON.parse((await read("ro")).text);
  ok("...and say so, with their category and flags", ro.readOnly === true && ro.important === true && ro.category === "Work");
  ok("the default category reads as none, the vocabulary edit_note takes", view.category === null);
  ok("the updated time is readable", new Date(view.updatedAt).getTime() === 100);
}
{
  const { read } = harness();
  const { content } = JSON.parse((await read("pic")).text);
  ok("read replaces images", !content.includes("base64") && !content.includes("QUJD") && content.includes("[image]"), content);
  ok(
    "...every one, whatever is in its attributes, and the rest stays",
    content === "<p><strong>before</strong></p>[image]<p>after</p>[image]",
    content
  );
  ok(
    "an image of an old version, pointing to a file, too",
    V.withoutImageData('<p>a</p><img src="file:///x.jpg"><p>b</p>') === `<p>a</p>${V.IMAGE_PLACEHOLDER}<p>b</p>`
  );
  ok("no image, no change", V.withoutImageData("<p>im not an <b>img</b></p>") === "<p>im not an <b>img</b></p>");
  ok("an uppercase tag", V.withoutImageData('<IMG SRC="x">') === V.IMAGE_PLACEHOLDER);
  ok("a tag starting the same isn't an image", V.withoutImageData("<imgx>") === "<imgx>");
}
{
  const long = "x".repeat(150_000);
  const { read } = harness([textNote("long", 1, { text: long })]);
  const first = JSON.parse((await read("long")).text);
  const second = JSON.parse((await read("long", first.nextOffset)).text);
  ok(
    "read pages long notes",
    first.content.length === 100000 && first.nextOffset === 100000 && second.nextOffset === undefined,
    { first: first.content.length, next: first.nextOffset, second: second.nextOffset }
  );
  ok("...and the parts make up the note", first.content + second.content === long);
  ok("a short note has no next part", JSON.parse((await read("long", 149_000)).text).nextOffset === undefined);
  ok("past the end: nothing, no error", JSON.parse((await read("long", 999_999)).text).content === "");
  ok(
    "an offset that makes no sense reads from the start",
    JSON.parse((await read("long", -5)).text).nextOffset === 100000 &&
      JSON.parse((await read("long", "12")).text).nextOffset === 100000
  );
  ok("a fractional offset is rounded down", JSON.parse((await read("long", 149_999.5)).text).content === "x");
}
{
  const text = `${"x".repeat(99_999)}🎉${"y".repeat(10)}`;
  const { read } = harness([textNote("emoji", 1, { text })]);
  const first = JSON.parse((await read("emoji")).text);
  const second = JSON.parse((await read("emoji", first.nextOffset)).text);
  ok("a part never ends inside an emoji", first.content.length === 99_999 && first.nextOffset === 99_999, first.nextOffset);
  ok("...which starts the next one", second.content.startsWith("🎉") && first.content + second.content === text);
}
{
  const { read } = harness();
  const todo = JSON.parse((await read("todo")).text);
  const board = JSON.parse((await read("board")).text);
  const code = JSON.parse((await read("snippet")).text);
  ok(
    "todo content is JSON, with the ids edit_note needs",
    JSON.parse(todo.content)[1].id === "i2" && JSON.parse(todo.content)[1].checked === true
  );
  ok("kanban content is JSON", JSON.parse(board.content)[0].items[0].id === "k1");
  ok("code content is JSON", JSON.parse(code.content)[0].code === "fn HELLO() {}");

  const list = Array.from({ length: 2500 }, (_, i) => ({ id: `i${i}`, text: `item number ${i}`, checked: false }));
  const { read: readLong } = harness([{ ...textNote("longTodo", 1), type: "todo", text: undefined, list }]);
  const first = JSON.parse((await readLong("longTodo")).text);
  const second = JSON.parse((await readLong("longTodo", first.nextOffset)).text);
  ok("todos page over the same string", first.content.length === 100000 && first.nextOffset === 100000);
  ok(
    "...and the parts make up the list",
    second.nextOffset === undefined && JSON.parse(first.content + second.content).length === 2500
  );
}
{
  // An old note, from before note types: the editors and the encryption read it as text.
  const { type: _type, ...untyped } = textNote("old", 1, { text: "<p>OLDWORD</p>" });
  const { read, search } = harness([untyped]);
  const view = JSON.parse((await read("old")).text);
  ok("a note with no type reads as text", view.type === "text" && view.content === "<p>OLDWORD</p>");
  ok("...and is searched", ids(await search("OLDWORD")).join() === "old");
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* search_notes                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nsearch_notes");

{
  const { search, store } = harness();
  ok("search misses locked, by title", ids(await search("SECRETWORD")).length === 0);
  ok("search misses locked, by content", ids(await search("SECRETBODY")).length === 0);
  ok("search misses hidden, by title", ids(await search("HIDDENTITLE")).length === 0);
  ok("search misses hidden, by content", ids(await search("HIDDENWORD")).length === 0);
  ok("search misses the trash", ids(await search("TRASHWORD")).length === 0);

  store.dispatch(S.setShowHidden(true));
  ok("(show hidden is on)", store.getState().settings.showHidden === true);
  ok("search misses hidden, even with show hidden on", ids(await search("HIDDENWORD")).length === 0);
  ok("...and with no query", !ids(await search()).includes("hiddenNote"));
  store.dispatch(S.setShowHidden(false));

  // The same words, with the flags off, are found: the checks above aren't empty.
  const { search: plain } = harness([
    textNote("lockedNote", 1, { title: "SECRETWORD", text: "<p>SECRETBODY</p>" }),
    textNote("hiddenNote", 2, { title: "HIDDENTITLE", text: "<p>HIDDENWORD</p>" }),
  ]);
  ok(
    "(the same notes without the flags are found)",
    ids(await plain("SECRETBODY")).length === 1 && ids(await plain("HIDDENWORD")).length === 1
  );
}
{
  const { search } = harness();
  const list = ids(await search());
  ok("no query: most recently updated first", list[0] === "snippet", list);
  ok("...all of them in order", list.join() === "snippet,board,todo,pic,ro,open", list);
  ok("a blank query is no query", ids(await search("   ")).join() === list.join());
  ok("a query that isn't text is no query", ids(await search(5)).join() === list.join());
  const matches = ids(await search("body of"));
  ok("with a query too: most recently updated first", matches.join() === "ro,open", matches);
}
{
  const { search } = harness();
  ok("finds by title", ids(await search("title of open")).join() === "open");
  ok("finds by content, ignoring case", ids(await search("BODY OF OPEN")).join() === "open");
  ok("finds a todo by its items", ids(await search("milk")).join() === "todo");
  ok("finds a kanban by a card", ids(await search("write tests")).join() === "board");
  ok("finds a kanban by a column", ids(await search("backlog")).join() === "board");
  ok("finds a code note by its code", ids(await search("hello")).join() === "snippet");
  ok("finds a code note by a tab's title", ids(await search("main.rs")).join() === "snippet");
  ok("a todo's JSON isn't searched", ids(await search("checked")).length === 0);
  ok("a kanban's JSON isn't searched", ids(await search("columns")).length === 0 && ids(await search("#fff")).length === 0);
  ok("a code note's JSON isn't searched", ids(await search("language")).length === 0);
  ok("nothing found: an empty list, not an error", ids(await search("zzz")).length === 0);
}
{
  const { search } = harness();
  ok("search ignores image data", ids(await search("base64")).length === 0 && ids(await search("QUJD")).length === 0);
  ok("search ignores tags", ids(await search("strong")).length === 0 && ids(await search("<p>")).length === 0);
  ok("search ignores attributes", ids(await search("width")).length === 0);
  ok("a picture isn't the word image", ids(await search("image")).length === 0, ids(await search("image")));
  ok(
    "...though it shows where it was, in a snippet",
    found(await search("after"))[0].snippet.includes("[image]"),
    found(await search("after"))
  );
  ok(
    "the text around an image is found",
    ids(await search("before")).join() === "pic" && ids(await search("after")).join() === "pic"
  );
}
{
  const { search } = harness([
    textNote("n", 1, {
      title: "A note",
      text: `<p>${"lorem ".repeat(100)}</p><p>the NEEDLE here</p><p>${"ipsum ".repeat(100)}</p>`,
      important: true,
      readOnly: true,
      category: { ...ALL, order: 1, name: "Work", icon: "work", index: false },
    }),
  ]);
  const [hit] = found(await search("needle"));
  ok("a result says what it is", hit.id === "n" && hit.title === "A note" && hit.type === "text");
  ok("...its category and flags", hit.category === "Work" && hit.important === true && hit.readOnly === true);
  ok("...and when it changed", new Date(hit.updatedAt).getTime() === 1);
  ok("...with the text around the match", hit.snippet.includes("NEEDLE") && !hit.snippet.includes("<p>"), hit.snippet);
  ok("...kept short", hit.snippet.length <= 202, hit.snippet.length);
  ok("...and no content", hit.text === undefined && hit.content === undefined);
  const [first] = found(await search());
  ok("no query: the start of the note", first.snippet.startsWith("lorem lorem"), first.snippet);
  const [emoji] = found(await harness([textNote("e", 1, { text: `<p>${"🎉".repeat(300)}</p>` })]).search());
  ok("a snippet never ends inside an emoji", /^(🎉)+…$/u.test(emoji.snippet), emoji.snippet.slice(-5));
}
{
  const many = Array.from({ length: 60 }, (_, i) => textNote(`n${i}`, i + 1));
  const { search } = harness(many);
  const first = page(await search());
  ok("limit 20 by default", first.notes.length === 20 && first.notes[0].id === "n59");
  ok("...with a next page", first.nextOffset === 20, first.nextOffset);
  const second = page(await search(undefined, { offset: first.nextOffset }));
  ok("the next page goes on from there", second.notes[0].id === "n39" && second.nextOffset === 40);
  const most = page(await search(undefined, { limit: 500 }));
  ok("50 at most", most.notes.length === 50 && most.nextOffset === 50);
  const last = page(await search(undefined, { limit: 50, offset: 50 }));
  ok("the last page has no next", last.notes.length === 10 && last.nextOffset === undefined);
  ok("past the end: nothing", page(await search(undefined, { offset: 500 })).notes.length === 0);
  ok(
    "a limit of 0 or less is 1",
    page(await search(undefined, { limit: 0 })).notes.length === 1 &&
      page(await search(undefined, { limit: -3 })).notes.length === 1
  );
  ok("a limit that isn't a number is the default", page(await search(undefined, { limit: "many" })).notes.length === 20);
  ok("a fractional limit is rounded down", page(await search(undefined, { limit: 2.7 })).notes.length === 2);
  ok("a negative offset is the start", page(await search(undefined, { offset: -4 })).notes[0].id === "n59");
}
{
  // How many locked notes exist doesn't show: not in a page's length, not in whether there's a next page.
  const visible = Array.from({ length: 20 }, (_, i) => textNote(`v${i}`, i + 1));
  const locked = Array.from({ length: 5 }, (_, i) => textNote(`l${i}`, 100 + i, { locked: true }));
  const hidden = Array.from({ length: 5 }, (_, i) => textNote(`h${i}`, 200 + i, { hidden: true }));
  const { search } = harness([...visible, ...locked, ...hidden]);
  const result = page(await search());
  ok(
    "notes out of reach don't count for a page",
    result.notes.length === 20 && result.nextOffset === undefined,
    result.nextOffset
  );
}
{
  const { store, search } = harness();
  const before = store.getState().notes.items;
  const order = before.map((n) => n.id).join();
  await search();
  ok(
    "searching doesn't reorder the stored notes",
    store
      .getState()
      .notes.items.map((n) => n.id)
      .join() === order
  );
}
{
  const { search, read, categories } = harness();
  const replies = [await search(), await search(undefined, { limit: 50 }), await categories()];
  for (const note of SEED) replies.push(await read(note.id));
  const words = ["SECRETWORD", "SECRETBODY", "HIDDENTITLE", "HIDDENWORD", "TRASHWORD", "lockedNote", "hiddenNote"];
  ok(
    "no answer holds a word of a note out of reach, or its id",
    replies.every((reply) => words.every((word) => !reply.text.includes(word)))
  );
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* list_categories                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nlist_categories");

{
  const { categories, store, log } = harness();
  ok("a fresh app: no category to choose", JSON.parse((await categories()).text).categories.length === 0);
  store.dispatch(C.createCategory({ name: "Work", icon: "work" }));
  store.dispatch(C.createCategory({ name: "Casa", icon: "home" }));
  const names = JSON.parse((await categories()).text).categories;
  ok("categories leave out All", !names.includes("All"), names);
  ok("the others by name, in order", names.join() === "Work,Casa", names);
  ok("nothing dispatched", log.dispatched.length === 0);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* create_note                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\ncreate_note");

const creator = (notes = SEED, overrides = {}) => {
  const seen = { sanitized: [], webhooks: [], notified: [] };
  let counter = 0;
  const h = harness(notes, {
    newId: () => `gen-${++counter}`,
    sanitize: (html) => {
      seen.sanitized.push(html);
      return html.replace(/<script[\s\S]*?<\/script>/gi, "");
    },
    sendWebhook: (payload, body) => {
      seen.webhooks.push({ payload, body });
    },
    notifyNoteChanged: (id) => {
      seen.notified.push(id);
    },
    ...overrides,
  });
  h.store.dispatch(C.createCategory({ name: "Work", icon: "work" }));
  const stored = (id) => h.store.getState().notes.items.find((note) => note.id === id);
  const create = (args) => h.call("fastmemo_create_note", args);
  /** Creates a note and returns the reply with the note as the store holds it. */
  const made = async (args) => {
    const reply = await create(args);
    return { reply, note: reply.isError ? undefined : stored(JSON.parse(reply.text).id) };
  };
  return { ...h, seen, stored, create, made };
};

{
  const { made, seen, log, store } = creator();
  const { reply, note } = await made({
    type: "text",
    title: "  A title ",
    text: "<h1>Hi</h1><p>body</p><script>bad()</script>",
  });
  ok(
    "text note shape",
    note.type === "text" && note.updatedAt === note.createdAt + 1 && note.deleteDate === null && note.hidden === false,
    note
  );
  ok(
    "...with the app's clock, date and a trimmed title",
    note.createdAt === 1000 && note.date === "today" && note.title === "A title"
  );
  ok("...not important, not read-only, not locked", !note.important && !note.readOnly && !note.locked);
  ok("html goes through sanitize", seen.sanitized[0] === "<h1>Hi</h1><p>body</p><script>bad()</script>", seen.sanitized);
  ok("...and what it returns is stored", note.text === "<h1>Hi</h1><p>body</p>", note.text);
  const body = JSON.parse(reply.text);
  ok(
    "result has id and rev",
    reply.createdId === note.id && body.id === note.id && body.rev > 0 && body.rev === note.rev,
    reply
  );
  ok(
    "...the type, the title and no category",
    body.type === "text" && body.title === "A title" && body.category === null && body.note === undefined,
    body
  );
  ok("the note is the newest in the list", store.getState().notes.items[0].id === note.id);
  log.order.push("reply");
  ok("flushed before answering", log.order.join() === "dispatch,flush,reply", log.order);
}

{
  const { made, store } = creator();
  const before = store.getState().categories.items.length;
  const matched = await made({ type: "text", title: "t", text: "<p>x</p>", category: "work" });
  ok(
    "category matches ignoring case",
    matched.note.category.name === "Work" && JSON.parse(matched.reply.text).category === "Work"
  );
  const exact = await made({ type: "text", title: "t", text: "<p>x</p>", category: "Work" });
  ok("...and exactly", exact.note.category.name === "Work");
  const near = await made({ type: "text", title: "t", text: "<p>x</p>", category: "Wor" });
  ok(
    "a near match isn't a match",
    near.note.category.icon === "none" && /no category/i.test(JSON.parse(near.reply.text).note),
    near.reply
  );
  const all = await made({ type: "text", title: "t", text: "<p>x</p>", category: "all" });
  ok(
    "the default category isn't one to ask for",
    all.note.category.icon === "none" && /no category/i.test(JSON.parse(all.reply.text).note)
  );
  const none = await made({ type: "text", title: "t", text: "<p>x</p>" });
  ok(
    "no category asked: the default, no remark",
    none.note.category.icon === "none" && JSON.parse(none.reply.text).note === undefined
  );
  const odd = await made({ type: "text", title: "t", text: "<p>x</p>", category: 5 });
  ok("a category that isn't a name is refused", odd.reply.isError);
  ok("categories never created", store.getState().categories.items.length === before);
}

{
  const { made, create } = creator();
  const todo = await made({ type: "todo", title: "List", items: [{ text: "milk" }, { text: "eggs", checked: true }] });
  ok(
    "todo items get ids",
    todo.note.list.every((item) => item.id) && new Set(todo.note.list.map((i) => i.id)).size === 2,
    todo.note.list
  );
  ok(
    "...text and checked kept, unchecked by default",
    todo.note.list[0].checked === false && todo.note.list[1].checked === true && todo.note.list[1].text === "eggs"
  );
  ok("...no mode: the editor's default", !("mode" in todo.note));
  ok(
    "a todo without items is refused",
    (await create({ type: "todo", title: "x" })).isError && (await create({ type: "todo", title: "x", items: [] })).isError
  );
  ok("...and an item without text", (await create({ type: "todo", title: "x", items: [{ checked: true }] })).isError);
  ok("...and items that aren't a list", (await create({ type: "todo", title: "x", items: "milk" })).isError);
}

{
  const { made, create } = creator();
  const column = (i) => ({ name: `col ${i}`, cards: [`card ${i}`] });
  const ten = await create({ type: "kanban", title: "B", columns: Array.from({ length: 10 }, (_, i) => column(i)) });
  const eleven = await create({ type: "kanban", title: "B", columns: Array.from({ length: 11 }, (_, i) => column(i)) });
  ok("kanban: 10 columns pass, 11 are refused", !ten.isError && eleven.isError, eleven);
  const board = await made({
    type: "kanban",
    title: "B",
    columns: [{ name: "To do", cards: ["a", "b"] }, { name: "Done", color: M.KANBAN_COLUMN_COLORS[4] }, { name: "Later" }],
  });
  const [c0, c1, c2] = board.note.columns;
  ok(
    "kanban colors default in turn",
    c0.color === M.KANBAN_COLUMN_COLORS[0] && c2.color === M.KANBAN_COLUMN_COLORS[2],
    board.note.columns
  );
  ok("...a given one is kept", c1.color === M.KANBAN_COLUMN_COLORS[4]);
  ok(
    "...columns and cards have ids",
    [c0, c1, c2].every((c) => c.id) && c0.items.every((card) => card.id && card.text) && c0.items.length === 2
  );
  ok("...a column without cards is empty", c1.items.length === 0 && c2.items.length === 0);
  ok("...a card is just id and text", Object.keys(c0.items[0]).sort().join() === "id,text", c0.items[0]);
  ok(
    "a color the app doesn't have is refused",
    (await create({ type: "kanban", title: "B", columns: [{ name: "x", color: "red" }] })).isError
  );
  ok(
    "a kanban without columns is refused",
    (await create({ type: "kanban", title: "B" })).isError &&
      (await create({ type: "kanban", title: "B", columns: [] })).isError
  );
  ok(
    "...and a column without a name, a card that isn't text",
    (await create({ type: "kanban", title: "B", columns: [{ cards: [] }] })).isError &&
      (await create({ type: "kanban", title: "B", columns: [{ name: "x", cards: [1] }] })).isError
  );
}

{
  const { made, create } = creator();
  const code = await made({
    type: "code",
    title: "Snippets",
    tabs: [
      { title: "main.rs", code: "fn main() {}" },
      { title: "script", code: "print(1)", language: "python" },
      { title: "notes", code: "plain" },
      { title: "wrong.ts", code: "let a", language: "klingon" },
    ],
  });
  const tabs = code.note.tabs;
  ok("code: first tab active", code.note.activeTabId === tabs[0].id && !!tabs[0].id);
  ok("...a language from the file name", tabs[0].language === "rust", tabs);
  ok("...the given language wins", tabs[1].language === "python");
  ok("...the editor's default otherwise", tabs[2].language === "javascript");
  ok("...a language the app doesn't have is replaced as if not given", tabs[3].language === "typescript", tabs[3]);
  ok(
    "...tabs have distinct ids and keep their code",
    new Set(tabs.map((t) => t.id)).size === 4 && tabs[0].code === "fn main() {}"
  );
  ok(
    "a code note without tabs is refused",
    (await create({ type: "code", title: "x" })).isError && (await create({ type: "code", title: "x", tabs: [] })).isError
  );
  ok(
    "...and a tab without code or title",
    (await create({ type: "code", title: "x", tabs: [{ title: "a" }] })).isError &&
      (await create({ type: "code", title: "x", tabs: [{ code: "a" }] })).isError
  );
}

{
  const { made, create } = creator();
  const base = { type: "text", text: "<p>x</p>" };
  ok(
    "empty title refused",
    (await create({ ...base, title: "" })).isError && (await create({ ...base, title: "  \n " })).isError
  );
  ok("a title that isn't text refused", (await create({ ...base })).isError && (await create({ ...base, title: 3 })).isError);
  ok("title over 100 refused", (await create({ ...base, title: "x".repeat(101) })).isError);
  ok("...100 is fine", !(await create({ ...base, title: "x".repeat(100) })).isError);
  ok("...counted in characters, not code units", !(await create({ ...base, title: "🎉".repeat(100) })).isError);
  const lines = await made({ ...base, title: "Riassunto 🎉\ncall\r\nfinale" });
  ok("newlines in a title become spaces, emoji stay", lines.note.title === "Riassunto 🎉 call finale", lines.note.title);
  ok(
    "the title rules, on their own",
    I.normalizeTitle("a\nb").title === "a b" &&
      "error" in I.normalizeTitle("  ") &&
      "error" in I.normalizeTitle(undefined) &&
      "error" in I.normalizeTitle("x".repeat(I.MAX_TITLE + 1))
  );

  ok(
    "no content refused",
    (await create({ type: "text", title: "x" })).isError && (await create({ type: "text", title: "x", text: "  " })).isError
  );
  ok("text that isn't text refused", (await create({ type: "text", title: "x", text: ["<p>a</p>"] })).isError);
  ok(
    "an unknown type refused",
    (await create({ type: "image", title: "x", text: "a" })).isError && (await create({ title: "x", text: "a" })).isError
  );
  ok("text over the limit refused", (await create({ type: "text", title: "x", text: `<p>${"a".repeat(2000)}</p>` })).isError);
  ok("...also for the other types", (await create({ type: "todo", title: "x", items: [{ text: "a".repeat(2000) }] })).isError);
  ok("the limit counts bytes, not characters", (await create({ type: "text", title: "x", text: "é".repeat(600) })).isError);
  ok(
    "...and what sanitize left, not what came in",
    !(await create({ type: "text", title: "x", text: `<script>${"a".repeat(2000)}</script><p>ok</p>` })).isError
  );

  const sneaky = await made({
    ...base,
    title: "x",
    hidden: true,
    local: true,
    deleteDate: 5,
    rev: 99,
    id: "mine",
    updatedAt: 3,
  });
  ok("hidden and local in args are ignored", sneaky.note.hidden === false && sneaky.note.local === undefined);
  ok(
    "...so are an id, a deletion date and a revision",
    sneaky.note.id === sneaky.reply.createdId &&
      sneaky.note.id !== "mine" &&
      sneaky.note.deleteDate === null &&
      sneaky.note.rev !== 99
  );
}

{
  const { made, create, store, call } = creator();
  const flagged = await made({ type: "text", title: "x", text: "<p>x</p>", important: true, readOnly: true });
  ok("flags set", flagged.note.important && flagged.note.readOnly && !flagged.note.locked, flagged.note);
  const not = await made({ type: "text", title: "x", text: "<p>x</p>", important: false, readOnly: false, locked: false });
  ok("false just means not set", !not.reply.isError && !not.note.important && !not.note.readOnly && !not.note.locked);
  ok(
    "a flag that isn't true or false is refused",
    (await create({ type: "text", title: "x", text: "<p>x</p>", important: "yes" })).isError
  );

  const locked = await create({ type: "text", title: "LOCKEDNEW", text: "<p>x</p>", locked: true });
  const inStore = store.getState().notes.items.find((note) => note.title === "LOCKEDNEW");
  ok("a locked note is created locked", inStore?.locked === true);
  ok("a locked note reports no id", locked.createdId === undefined && !locked.isError, locked);
  ok("...in words only: no id and no rev in the text", locked.text === "Created." && !locked.text.includes(inStore.id));
  ok("...and is out of reach then", (await call("fastmemo_read_note", { id: inStore.id })).text === NOT_FOUND);
}

{
  const { create, seen } = creator();
  await create({ type: "text", title: "a", text: "<p>a</p>" });
  await create({ type: "todo", title: "b", items: [{ text: "i" }] });
  await create({ type: "kanban", title: "c", columns: [{ name: "n" }] });
  await create({ type: "code", title: "d", tabs: [{ title: "t", code: "c" }] });
  ok(
    "webhook per type",
    seen.webhooks.map((w) => w.body.action).join() === "note/addTextNote,note/addTodoNote,note/addKanbanNote,note/addCodeNote",
    seen.webhooks.map((w) => w.body.action)
  );
  const [text, todo, kanban, code] = seen.webhooks.map((w) => w.body);
  ok(
    "...with the note as the editors send it",
    text.title === "a" &&
      text.text === "<p>a</p>" &&
      text.category.name === "All" &&
      text.hidden === false &&
      text.type === "text",
    text
  );
  ok(
    "...and the content of its type",
    todo.list.length === 1 && kanban.columns.length === 1 && code.tabs.length === 1 && code.activeTabId === code.tabs[0].id
  );
  ok(
    "...to the user's setting for that type",
    seen.webhooks.every((w) => "url" in w.payload && "enabled" in w.payload)
  );
}

{
  const { create, seen } = creator(SEED, { persisted: () => false });
  const failed = await create({ type: "text", title: "x", text: "<p>x</p>" });
  ok("not persisted: an error, not a success", failed.isError && failed.createdId === undefined, failed);
  ok(
    "...saying so, and not to try again: that would make a copy",
    /isn't saved to disk/i.test(failed.text) && !/try again/i.test(failed.text) && /don't create it again/i.test(failed.text),
    failed.text
  );
  ok("...and no webhook for a note that isn't on disk", seen.webhooks.length === 0, seen.webhooks);
}
{
  // The write fails while it runs: `persisted()` reads true before the flush and false after it.
  let flushed = false;
  const { create, seen } = creator(SEED, {
    flush: async () => {
      await sleep(5);
      flushed = true;
    },
    persisted: () => !flushed,
  });
  const failed = await create({ type: "text", title: "x", text: "<p>x</p>" });
  ok(
    "persisted read after the flush: a write that fails during it is an error",
    failed.isError && failed.createdId === undefined && seen.webhooks.length === 0,
    failed
  );
}
{
  const { create } = creator(SEED, {
    sendWebhook: () => {
      throw new Error("WEBHOOKBROKE");
    },
  });
  const warn = console.warn;
  console.warn = () => {};
  const reply = await create({ type: "text", title: "x", text: "<p>x</p>" });
  console.warn = warn;
  ok("a failing webhook doesn't turn a saved note into an error", !reply.isError && !!reply.createdId, reply);
}

{
  const { create, log } = creator(SEED, { ready: () => false });
  const reply = await create({ type: "text", title: "x", text: "<p>x</p>" });
  ok("before the app is ready: refused, nothing dispatched", reply.isError && log.dispatched.length === 0);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* set_note_flags                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nset_note_flags");

{
  const { call, log, store, seen } = creator();
  const stored = (id) => store.getState().notes.items.find((note) => note.id === id);
  const flags = (id, args) => call("fastmemo_set_note_flags", { id, ...args });

  const revBefore = stored("open").rev;
  const set = await flags("open", { important: true, readOnly: true });
  const body = JSON.parse(set.text);
  ok("flags set", !set.isError && stored("open").important && stored("open").readOnly && !stored("open").locked, set);
  ok("rev moves", stored("open").rev > revBefore && body.rev === stored("open").rev);
  ok(
    "the reply has the rev and the flags",
    body.id === "open" && body.important === true && body.readOnly === true && body.locked === false,
    body
  );
  ok("...and no created id", set.createdId === undefined);
  ok(
    "the update webhook fires, with the note",
    seen.webhooks.length === 1 &&
      seen.webhooks[0].body.action === "note/updateNote" &&
      seen.webhooks[0].body.id === "open" &&
      seen.webhooks[0].body.important === true,
    seen.webhooks
  );
  log.order.push("reply");
  ok("flushed before answering, after the change", log.order.join() === "dispatch,dispatch,flush,reply", log.order);
  ok("an open editor is told once, with the id", seen.notified.join() === "open", seen.notified);

  const dispatchedBefore = log.dispatched.length;
  const again = await flags("open", { important: true, readOnly: true });
  ok(
    "a flag already set isn't toggled back",
    !again.isError && stored("open").important && stored("open").readOnly && log.dispatched.length === dispatchedBefore
  );
  ok("...no webhook for no change", seen.webhooks.length === 1);
  ok("...and no telling the editor", seen.notified.length === 1, seen.notified);
  const invalidCall = await flags("open", { readOnly: false });
  ok("a refused call tells no editor", invalidCall.isError && seen.notified.length === 1);

  await flags("open", { important: false });
  ok("important both ways", stored("open").important === false);
  await flags("open", { important: true });
  ok("...true again", stored("open").important === true);

  const countBefore = log.dispatched.length;
  ok("locked:false refused", (await flags("open", { locked: false })).isError && log.dispatched.length === countBefore);
  ok("readOnly:false refused", (await flags("open", { readOnly: false })).isError && log.dispatched.length === countBefore);
  ok(
    "...even with another flag that would be fine",
    (await flags("open", { important: false, readOnly: false })).isError && stored("open").important === true
  );
  ok(
    "a flag that isn't a boolean refused",
    (await flags("open", { important: "yes" })).isError && log.dispatched.length === countBefore
  );
  ok("nothing to set refused", (await flags("open", {})).isError && log.dispatched.length === countBefore);

  ok("already read-only: no toggle", (await flags("ro", { readOnly: true }), stored("ro").readOnly === true));
  ok(
    "a read-only note can still be marked important",
    !(await flags("ro", { important: false })).isError && stored("ro").important === false
  );

  ok(
    "locked and hidden notes: not found",
    (await flags("lockedNote", { important: true })).text === NOT_FOUND &&
      (await flags("hiddenNote", { important: true })).text === NOT_FOUND
  );
  ok("...and untouched", stored("lockedNote").important === false && stored("hiddenNote").important === false);
  ok(
    "a made-up id and a trashed one: not found",
    (await flags("made-up", { important: true })).text === NOT_FOUND && (await flags("gone", { important: true })).isError
  );
  ok("an id that isn't text: not found", (await call("fastmemo_set_note_flags", { important: true })).text === NOT_FOUND);

  const lock = await flags("todo", { locked: true });
  ok("locked set", !lock.isError && stored("todo").locked === true && JSON.parse(lock.text).locked === true, lock);
  ok(
    "...and then out of reach",
    (await flags("todo", { important: true })).text === NOT_FOUND &&
      (await call("fastmemo_read_note", { id: "todo" })).text === NOT_FOUND
  );
}

{
  const typed = textNote("open", 100, { text: "<p>TYPED</p>" });
  const context = {};
  const h = creator(SEED, { commitPending: () => context.store.dispatch(N.addNote(typed)) });
  context.store = h.store;
  const reply = await h.call("fastmemo_set_note_flags", { id: "open", important: true });
  const stored = h.store.getState().notes.items.find((note) => note.id === "open");
  ok(
    "what the editor still held is committed first",
    stored.text === "<p>TYPED</p>" && stored.important === true && JSON.parse(reply.text).rev === stored.rev
  );
}

{
  const { call, store, seen } = creator(SEED, { persisted: () => false });
  const first = await call("fastmemo_set_note_flags", { id: "open", important: true });
  ok("not persisted: an error, not a success", first.isError, first);
  ok("...and no webhook for what isn't on disk", seen.webhooks.length === 0, seen.webhooks);
  const retry = await call("fastmemo_set_note_flags", { id: "open", important: true });
  ok(
    "a retry finds the flag set and still says it isn't on disk",
    retry.isError && store.getState().notes.items.find((n) => n.id === "open").important === true,
    retry
  );
  ok("...the editor was told only of the change", seen.notified.join() === "open", seen.notified);
}
{
  let flushed = false;
  const { call, seen } = creator(SEED, {
    flush: async () => {
      await sleep(5);
      flushed = true;
    },
    persisted: () => !flushed,
  });
  const reply = await call("fastmemo_set_note_flags", { id: "open", important: true });
  ok("a write that fails during the flush is an error", reply.isError && seen.webhooks.length === 0, reply);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* edit_note and trash_note                                                                                            */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nedit_note");

const ALL_NOTES = { editAll: true, ownedIds: [] };

const editor = (notes = SEED, overrides = {}) => {
  const c = creator(notes, overrides);
  const edit = (id, rev, changes = {}, scope = ALL_NOTES) =>
    c.call("fastmemo_edit_note", { ...(id !== undefined && { id }), ...(rev !== undefined && { rev }), ...changes }, scope);
  /** The edit, at the revision the store holds. */
  const editNow = (id, changes, scope) => edit(id, c.stored(id)?.rev, changes, scope);
  const trash = (id) => c.call("fastmemo_trash_note", { ...(id !== undefined && { id }) });
  const inItems = (id) => c.store.getState().notes.items.some((note) => note.id === id);
  const inTrash = (id) => c.store.getState().notes.temporaryItems.some((note) => note.id === id);
  return { ...c, edit, editNow, trash, inItems, inTrash };
};

{
  const { edit, editNow, stored, log, seen } = editor();
  const before = stored("open");

  const noRev = await edit("open", undefined, { title: "x" });
  ok("needs rev", noRev.isError && noRev.text.includes("`rev`"), noRev);
  const badRev = await edit("open", "5", { title: "x" });
  ok("a rev that isn't a number: refused the same way", badRev.isError && badRev.text.includes("`rev`"), badRev);
  const stale = await edit("open", before.rev - 1, { title: "x" });
  ok(
    "stale rev refused, note unchanged",
    stale.isError &&
      stale.text.includes("changed") &&
      stale.text.includes("Read it again") &&
      stored("open").title === before.title,
    stale
  );
  ok(
    "...nothing dispatched, no editor told, no webhook",
    log.dispatched.length === 0 && seen.notified.length === 0 && seen.webhooks.length === 0
  );
  ok("pending edits committed first", log.commits === 3, log.commits);

  const reply = await editNow("open", { title: "  New title " });
  const body = JSON.parse(reply.text);
  ok("an edit at the right rev is made", !reply.isError && stored("open").title === "New title", reply);
  ok(
    "the reply has the id, new rev, type and title",
    body.id === "open" &&
      body.rev === stored("open").rev &&
      body.rev > before.rev &&
      body.type === "text" &&
      body.title === "New title",
    body
  );
  ok("rev and updatedAt move", stored("open").rev > before.rev && stored("open").updatedAt === 1000, stored("open"));
  ok("the old rev is now stale", (await edit("open", before.rev, { title: "again" })).isError);
}
{
  // The user's typing is committed by `commitPending`, which moves the revision: the edit at the old one loses.
  const typed = textNote("open", 100, { text: "<p>TYPEDWORD</p>" });
  const context = {};
  let typedOnce = false;
  const h = editor(SEED, {
    commitPending: () => {
      if (!typedOnce) context.store.dispatch(N.addNote(typed));
      typedOnce = true;
    },
  });
  context.store = h.store;
  const oldRev = h.stored("open").rev;
  const lost = await h.edit("open", oldRev, { appendHtml: "<p>from the agent</p>" });
  ok("user typing wins: the edit at the old rev is refused", lost.isError && lost.text.includes("changed"), lost);
  ok("...and the typed text stays", h.stored("open").text === "<p>TYPEDWORD</p>", h.stored("open").text);
  const again = await h.edit("open", h.stored("open").rev, { appendHtml: "<p>from the agent</p>" });
  ok(
    "read again, the edit goes through on the typed text",
    !again.isError && h.stored("open").text === "<p>TYPEDWORD</p><p>from the agent</p>",
    again
  );
}
{
  const { edit, editNow, stored, trash, log } = editor();
  const ro = await editNow("ro", { title: "x" });
  ok("read-only refused", ro.isError && stored("ro").title === "title of ro", ro);
  ok("...saying so", /read-only/i.test(ro.text), ro);

  const owning = { editAll: true, ownedIds: ["lockedNote", "hiddenNote", "gone", "made-up"] };
  const replies = [];
  for (const id of ["lockedNote", "hiddenNote", "gone", "made-up", undefined, 7]) {
    for (const [rev, scope] of [
      [1, ALL_NOTES],
      [undefined, ALL_NOTES],
      [1, owning],
      [1, { editAll: false, ownedIds: [] }],
    ]) {
      replies.push(await edit(id, rev, { title: "x" }, scope));
    }
  }
  ok(
    "locked, hidden, trashed, unknown: not found, whatever the rev or the scope",
    replies.every((reply) => reply.isError && reply.text === NOT_FOUND),
    replies.find((reply) => reply.text !== NOT_FOUND)
  );
  ok("...and none of them dispatched anything", log.dispatched.length === 0);
  ok("trash says the same for a locked note", (await trash("lockedNote")).text === NOT_FOUND);
}

console.log("\nedit_note: the session rule");

{
  const { edit, stored, made } = editor();
  const off = { editAll: false, ownedIds: [] };
  const outOfScope = await edit("open", stored("open").rev, { title: "x" }, off);
  ok(
    "switch off, not owned: refused, and why",
    outOfScope.isError &&
      outOfScope.text.includes("session") &&
      outOfScope.text.includes("settings") &&
      stored("open").title === "title of open",
    outOfScope
  );
  const owned = await edit("open", stored("open").rev, { title: "mine" }, { editAll: false, ownedIds: ["open"] });
  ok("switch off, owned: allowed", !owned.isError && stored("open").title === "mine", owned);
  const all = await edit("open", stored("open").rev, { title: "all" }, ALL_NOTES);
  ok("switch on: allowed", !all.isError && stored("open").title === "all", all);
  const ownedRo = await edit("ro", stored("ro").rev, { title: "x" }, { editAll: false, ownedIds: ["ro"] });
  ok("owned and read-only: refused", ownedRo.isError && stored("ro").title === "title of ro", ownedRo);
  const ownedLocked = await edit("lockedNote", 1, { title: "x" }, { editAll: false, ownedIds: ["lockedNote"] });
  ok("owned and locked: not found", ownedLocked.isError && ownedLocked.text === NOT_FOUND, ownedLocked);

  // What the bridge's scope is made of: a note created in this session, at the rev the creation returned.
  const { reply, note } = await made({ type: "text", title: "fresh", text: "<p>x</p>" });
  const fresh = await edit(
    note.id,
    JSON.parse(reply.text).rev,
    { appendHtml: "<p>y</p>" },
    { editAll: false, ownedIds: [note.id] }
  );
  ok(
    "a note created through the tool can be edited at the rev it returned",
    !fresh.isError && stored(note.id).text === "<p>x</p><p>y</p>",
    fresh
  );
  const otherSession = await edit(note.id, stored(note.id).rev, { appendHtml: "<p>z</p>" }, off);
  ok(
    "...and not by a session that doesn't own it",
    otherSession.isError && otherSession.text.includes("session"),
    otherSession
  );
}

console.log("\nedit_note: text");

{
  const { editNow, stored, seen, edit } = editor();
  const picBefore = stored("pic").text;
  const added = await editNow("pic", { appendHtml: "<p>added</p><script>bad()</script>" });
  const text = stored("pic").text;
  ok(
    "appendHtml keeps images and is sanitized",
    !added.isError &&
      text === `${picBefore}<p>added</p>` &&
      (text.match(/<img/g) ?? []).length === 2 &&
      !text.includes("script"),
    text
  );
  ok(
    "...only the new part went through the sanitizer",
    seen.sanitized.join() === "<p>added</p><script>bad()</script>",
    seen.sanitized
  );

  const imgReplace = await editNow("pic", { replaceHtml: "<p>all new</p>" });
  ok(
    "replaceHtml refused when the note has images",
    imgReplace.isError && /images/.test(imgReplace.text) && stored("pic").text === text,
    imgReplace
  );

  const titleOnly = await editNow("pic", { title: "renamed" });
  ok("a rename leaves the images and text byte for byte", !titleOnly.isError && stored("pic").text === text);

  const replaced = await editNow("open", { replaceHtml: "<h1>new</h1><script>bad()</script>" });
  ok(
    "replaceHtml works without images, sanitized",
    !replaced.isError && stored("open").text === "<h1>new</h1>",
    stored("open").text
  );

  const both = await editNow("open", { replaceHtml: "<p>a</p>", appendHtml: "<p>b</p>" });
  ok("replaceHtml and appendHtml together: refused", both.isError && stored("open").text === "<h1>new</h1>", both);
  ok(
    "replaceHtml with nothing left after cleaning: refused",
    (await editNow("open", { replaceHtml: "<script>x</script>" })).isError
  );
  ok(
    "appendHtml with nothing left after cleaning: refused",
    (await editNow("open", { appendHtml: "<script>x</script>" })).isError
  );
  ok(
    "html that isn't text: refused",
    (await editNow("open", { appendHtml: 5 })).isError && (await editNow("open", { replaceHtml: {} })).isError
  );

  const tail = await editNow("open", { appendHtml: "<ul><li>one</li></ul>" });
  ok(
    "appendHtml joins at the end",
    !tail.isError && stored("open").text === "<h1>new</h1><ul><li>one</li></ul>",
    stored("open").text
  );
  const asked = seen.sanitized.length;
  ok(
    "an edit refused for the revision leaves the sanitizer unasked",
    (await edit("open", 1, { appendHtml: "<p>q</p>" })).isError && seen.sanitized.length === asked,
    seen.sanitized.length
  );
}

console.log("\nedit_note: title, category, nothing to change");

{
  const { editNow, stored, store, log, seen } = editor();
  ok("a title that is too long: refused", (await editNow("open", { title: "x".repeat(101) })).isError);
  ok("an empty title: refused", (await editNow("open", { title: "  " })).isError);
  const titled = await editNow("open", { title: "two\nlines" });
  ok("a title is one line", !titled.isError && stored("open").title === "two lines", stored("open").title);

  const categories = store.getState().categories.items.length;
  const set = await editNow("open", { category: "work" });
  ok(
    "a category by name, ignoring case",
    !set.isError && stored("open").category.name === "Work" && stored("open").category.icon === "work",
    stored("open").category
  );
  const unknown = await editNow("open", { category: "Nonexistent" });
  ok(
    "a name with no match: refused, and says so",
    unknown.isError && /Nonexistent/.test(unknown.text) && stored("open").category.name === "Work",
    unknown
  );
  ok("...nothing is created", store.getState().categories.items.length === categories);
  ok("the default category can't be chosen by name", (await editNow("open", { category: "All" })).isError);
  ok("a category that isn't a name: refused", (await editNow("open", { category: 5 })).isError);
  const back = await editNow("open", { category: null });
  ok(
    "null is the default category",
    !back.isError && stored("open").category.icon === "none" && stored("open").category.name === "All",
    stored("open").category
  );

  const dispatched = log.dispatched.length;
  const hooks = seen.webhooks.length;
  const notified = seen.notified.length;
  const same = [
    await editNow("open", {}),
    await editNow("open", { unknownField: 1 }),
    await editNow("open", { title: stored("open").title }),
    await editNow("open", { category: null }),
    await editNow("open", { appendHtml: undefined }),
    await editNow("open", { replaceHtml: stored("open").text }),
  ];
  ok(
    "no change at all: refused as nothing to change",
    same.every((r) => r.isError && /nothing to change/i.test(r.text)),
    same.find((r) => !r.isError || !/nothing/i.test(r.text))
  );
  ok(
    "...no dispatch, no webhook, no editor told",
    log.dispatched.length === dispatched && seen.webhooks.length === hooks && seen.notified.length === notified
  );
}

console.log("\nedit_note: todo, kanban, code");

{
  const { editNow, stored } = editor();
  const added = await editNow("todo", {
    addItems: [{ text: "new one" }, { text: "done one", checked: true }, { text: "   " }],
  });
  const list = stored("todo").list;
  ok(
    "todo: add",
    !added.isError &&
      list.length === 4 &&
      list[2].text === "new one" &&
      list[2].checked === false &&
      list[3].checked === true &&
      list[2].id.startsWith("gen-"),
    list
  );
  const updated = await editNow("todo", {
    updateItems: [
      { id: "i1", checked: true },
      { id: "i2", text: "call Bob" },
    ],
  });
  ok(
    "todo: update",
    !updated.isError &&
      stored("todo").list[0].checked === true &&
      stored("todo").list[0].text === "buy MILK" &&
      stored("todo").list[1].text === "call Bob" &&
      stored("todo").list[1].checked === true,
    stored("todo").list
  );
  const removed = await editNow("todo", { removeItemIds: ["i1"] });
  ok(
    "todo: remove",
    !removed.isError &&
      stored("todo")
        .list.map((i) => i.id)
        .join() === "i2,gen-1,gen-2",
    stored("todo").list
  );

  const before = JSON.stringify(stored("todo"));
  ok(
    "todo: removing an unknown id: refused, nothing applied",
    (await editNow("todo", { addItems: [{ text: "z" }], removeItemIds: ["nope"] })).isError &&
      JSON.stringify(stored("todo")) === before
  );
  ok("todo: updating an unknown id: refused", (await editNow("todo", { updateItems: [{ id: "nope", text: "z" }] })).isError);
  ok("todo: an update that changes nothing named: refused", (await editNow("todo", { updateItems: [{ id: "i2" }] })).isError);
  ok(
    "todo: checked that isn't true or false: refused",
    (await editNow("todo", { updateItems: [{ id: "i2", checked: "yes" }] })).isError
  );
  ok("todo: a list that isn't a list: refused", (await editNow("todo", { addItems: "x" })).isError);
}
{
  const { editNow, stored } = editor();
  const colors = M.KANBAN_COLUMN_COLORS;
  const added = await editNow("board", { addColumns: [{ name: " Doing " }, { name: "Done", color: colors[3].toUpperCase() }] });
  const columns = stored("board").columns;
  ok(
    "kanban: add columns, colors as in create",
    !added.isError &&
      columns.length === 3 &&
      columns[1].name === "Doing" &&
      columns[1].color === colors[1 % colors.length] &&
      columns[2].color === colors[3],
    columns
  );
  const doing = columns[1].id;
  const cards = await editNow("board", {
    addCards: [
      { columnId: "c1", text: "second" },
      { columnId: doing, text: "in doing" },
    ],
  });
  ok(
    "kanban: add cards",
    !cards.isError && stored("board").columns[0].items.length === 2 && stored("board").columns[1].items[0].text === "in doing",
    stored("board").columns
  );
  const moved = await editNow("board", { moveCards: [{ cardId: "k1", toColumnId: doing }] });
  ok(
    "kanban: move a card",
    !moved.isError &&
      stored("board")
        .columns[0].items.map((i) => i.text)
        .join() === "second" &&
      stored("board").columns[1].items.some((i) => i.id === "k1"),
    stored("board").columns
  );
  const removed = await editNow("board", { removeCardIds: ["k1"] });
  ok(
    "kanban: remove a card",
    !removed.isError && !stored("board").columns.some((c) => c.items.some((i) => i.id === "k1")),
    stored("board").columns
  );

  const before = JSON.stringify(stored("board"));
  const unknownCard = await editNow("board", { addColumns: [{ name: "X" }], removeCardIds: ["nope"] });
  ok(
    "kanban: a card id that doesn't exist: refused, nothing applied",
    unknownCard.isError && JSON.stringify(stored("board")) === before,
    unknownCard
  );
  ok(
    "kanban: a column id that doesn't exist: refused (add and move)",
    (await editNow("board", { addCards: [{ columnId: "nope", text: "z" }] })).isError &&
      (await editNow("board", { moveCards: [{ cardId: "k2", toColumnId: "nope" }] })).isError
  );
  ok(
    "kanban: a color outside the list: refused",
    (await editNow("board", { addColumns: [{ name: "X", color: "#123456" }] })).isError
  );
  ok("kanban: a column without a name: refused", (await editNow("board", { addColumns: [{ color: colors[0] }] })).isError);
  ok("kanban: a card without text: refused", (await editNow("board", { addCards: [{ columnId: "c1", text: " " }] })).isError);
}
{
  const { editNow, stored } = editor();
  const before = JSON.stringify(stored("board"));
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `col ${i}` }));
  ok(
    "kanban: 10 columns at most",
    (await editNow("board", { addColumns: [...many, { name: "one too many" }, { name: "two" }] })).isError &&
      JSON.stringify(stored("board")) === before
  );
  const ten = await editNow("board", { addColumns: [...many, { name: "last" }] });
  ok("...ten are fine", !ten.isError && stored("board").columns.length === 10, ten);
  ok(
    "...and the eleventh isn't",
    (await editNow("board", { addColumns: [{ name: "11th" }] })).isError && stored("board").columns.length === 10
  );
}
{
  const { editNow, stored } = editor();
  const added = await editNow("snippet", {
    addTabs: [
      { title: "util.py", code: "print(1)" },
      { title: "notes", code: "x", language: "TypeScript" },
    ],
  });
  const tabs = stored("snippet").tabs;
  ok(
    "code: add tabs, language as in create",
    !added.isError &&
      tabs.length === 3 &&
      tabs[1].language === "python" &&
      tabs[2].language === "typescript" &&
      tabs[1].id.startsWith("gen-"),
    tabs
  );
  const updated = await editNow("snippet", {
    updateTabs: [
      { id: "t1", code: "fn BYE() {}", title: " lib.rs " },
      { id: tabs[1].id, language: "javascript" },
    ],
  });
  ok(
    "code: update tabs",
    !updated.isError &&
      stored("snippet").tabs[0].code === "fn BYE() {}" &&
      stored("snippet").tabs[0].title === "lib.rs" &&
      stored("snippet").tabs[0].language === "rust" &&
      stored("snippet").tabs[1].language === "javascript",
    stored("snippet").tabs
  );
  ok(
    "code: the active tab is still one of the tabs",
    stored("snippet").tabs.some((t) => t.id === stored("snippet").activeTabId) && stored("snippet").activeTabId === "t1"
  );
  ok("code: an unknown tab: refused", (await editNow("snippet", { updateTabs: [{ id: "nope", code: "x" }] })).isError);
  ok(
    "code: a language the editor hasn't: refused",
    (await editNow("snippet", { updateTabs: [{ id: "t1", language: "klingon" }] })).isError
  );
  ok("code: a tab without code: refused", (await editNow("snippet", { addTabs: [{ title: "x" }] })).isError);
}

console.log("\nedit_note: types, size, the pure function");

{
  const { editNow, stored } = editor();
  const before = JSON.stringify(stored("todo"));
  const wrong = await editNow("todo", { title: "renamed", appendHtml: "<p>x</p>" });
  ok(
    "a field of another type refused, naming both",
    wrong.isError && wrong.text.includes("appendHtml") && wrong.text.includes("todo"),
    wrong
  );
  ok("...with no partial application: the title stayed", JSON.stringify(stored("todo")) === before);
  const cases = [
    ["open", { addItems: [{ text: "x" }] }, "addItems", "text"],
    ["board", { addTabs: [{ title: "a", code: "b" }] }, "addTabs", "kanban"],
    ["snippet", { addColumns: [{ name: "a" }] }, "addColumns", "code"],
    ["todo", { moveCards: [] }, "moveCards", "todo"],
  ];
  for (const [id, changes, field, type] of cases) {
    const reply = await editNow(id, changes);
    ok(`${field} on a ${type} note: refused`, reply.isError && reply.text.includes(field) && reply.text.includes(type), reply);
  }
}
{
  const { editNow, stored } = editor(SEED, { textLimit: () => 300 });
  const big = await editNow("open", { appendHtml: `<p>${"x".repeat(400)}</p>` });
  ok(
    "the size limit applies to the edited note",
    big.isError && /too big/.test(big.text) && stored("open").text === "<p>body of open</p>",
    big
  );
  ok("...below it, fine", !(await editNow("open", { appendHtml: "<p>ok</p>" })).isError);
  const todoBig = await editNow("todo", { addItems: [{ text: "y".repeat(400) }] });
  ok("...for the other types too", todoBig.isError && /too big/.test(todoBig.text), todoBig);
  const over = editor([textNote("fat", 5, { text: `<p>${"z".repeat(400)}</p>` })], { textLimit: () => 300 });
  ok("a note already over the limit can still be renamed", !(await over.editNow("fat", { title: "slimmer" })).isError);
}
{
  const { editing } = M;
  const h = creator();
  const deps = { getState: h.store.getState, newId: () => "n1", sanitize: (html) => html, textLimit: () => 1000 };
  const frozen = (value) => {
    Object.values(value).forEach((inner) => typeof inner === "object" && inner !== null && frozen(inner));
    return Object.freeze(value);
  };
  const todo = frozen(structuredClone(h.stored("todo")));
  const snapshot = JSON.stringify(todo);
  const fails = editing.applyEdit(
    todo,
    { title: "new", updateItems: [{ id: "i1", text: "changed" }], removeItemIds: ["nope"] },
    deps
  );
  ok("applyEdit: an error, and the note it was given is as it was", "error" in fails && JSON.stringify(todo) === snapshot);
  const works = editing.applyEdit(
    todo,
    { title: "new", updateItems: [{ id: "i1", text: "changed" }], addItems: [{ text: "more" }] },
    deps
  );
  ok(
    "applyEdit: a result that isn't the input, which is as it was",
    "note" in works && works.note !== todo && JSON.stringify(todo) === snapshot,
    works
  );
  ok(
    "...with the changes",
    works.note.title === "new" &&
      works.note.list[0].text === "changed" &&
      works.note.list.length === 3 &&
      works.note.id === "todo"
  );
  const board = frozen(structuredClone(h.stored("board")));
  const boardSnapshot = JSON.stringify(board);
  const moved = editing.applyEdit(
    board,
    { addCards: [{ columnId: "c1", text: "a" }], moveCards: [{ cardId: "k1", toColumnId: "c1" }] },
    deps
  );
  ok("applyEdit: kanban doesn't touch the input either", "note" in moved && JSON.stringify(board) === boardSnapshot, moved);
}

console.log("\nedit_note: the store, the editor, the webhook, the disk");

{
  const { editNow, stored, store, seen, log } = editor();
  store.dispatch(N.setNoteFilters({ sortBy: "updatedAt", order: "desc" }));
  store.dispatch(N.reorderNotes());
  ok("(sorted by update time, 'open' is not first)", store.getState().notes.items[0].id !== "open");
  const oldRev = stored("open").rev;
  log.dispatched.length = 0;
  log.order.length = 0;
  await editNow("open", { title: "moved up" });
  ok(
    "rev and updatedAt move, sorted again",
    stored("open").rev > oldRev && store.getState().notes.items[0].id === "open",
    store.getState().notes.items.map((n) => n.id)
  );
  ok(
    "dispatched as a change to the stored note, then sorted",
    log.dispatched.length === 2 &&
      log.dispatched[0].type === "notes/addNote" &&
      log.dispatched[1].type === "notes/reorderNotes",
    log.dispatched.map((a) => a.type)
  );
  ok("the upload is queued", store.getState().notes.cloud.items.add.open !== undefined, store.getState().notes.cloud.items.add);
  ok("open editor told, once, with the id", seen.notified.join() === "open", seen.notified);
  ok(
    "the webhook note/updateNote, with the note as stored",
    seen.webhooks.length === 1 &&
      seen.webhooks[0].body.action === "note/updateNote" &&
      seen.webhooks[0].body.id === "open" &&
      seen.webhooks[0].body.title === "moved up" &&
      seen.webhooks[0].body.text === "<p>body of open</p>" &&
      seen.webhooks[0].body.updatedAt === 1000,
    seen.webhooks
  );
  ok("...through the update webhook's settings", "url" in seen.webhooks[0].payload && "enabled" in seen.webhooks[0].payload);
  ok(
    "flushed before answering: the write came after the dispatches",
    log.order.join() === "dispatch,dispatch,flush",
    log.order
  );
}
{
  const { editNow, seen } = editor();
  await editNow("todo", { addItems: [{ text: "item" }] });
  await editNow("board", { addColumns: [{ name: "col" }] });
  await editNow("snippet", { addTabs: [{ title: "a.js", code: "1" }] });
  const [todo, board, code] = seen.webhooks.map((w) => w.body);
  ok(
    "the webhook has the content of each type",
    todo.list.length === 3 &&
      board.columns.length === 2 &&
      code.tabs.length === 2 &&
      code.activeTabId === "t1" &&
      !("text" in todo),
    seen.webhooks.map((w) => Object.keys(w.body))
  );
}
{
  let flushed = false;
  const { editNow, stored, seen } = editor(SEED, {
    flush: async () => {
      await sleep(5);
      flushed = true;
    },
    persisted: () => !flushed,
  });
  const failed = await editNow("open", { appendHtml: "<p>once</p>" });
  ok(
    "a failed save is an error that says the change is made and not to repeat it",
    failed.isError &&
      /isn't saved to disk/.test(failed.text) &&
      /don't repeat/i.test(failed.text) &&
      !/try again/i.test(failed.text),
    failed.text
  );
  ok(
    "...the change is in the store (a retry is a stale rev), the editor was told, no webhook",
    stored("open").text === "<p>body of open</p><p>once</p>" && seen.notified.join() === "open" && seen.webhooks.length === 0
  );
}
{
  const { editNow } = editor(SEED, {
    sendWebhook: () => {
      throw new Error("WEBHOOKBROKE");
    },
  });
  const warn = console.warn;
  console.warn = () => {};
  const reply = await editNow("open", { title: "still saved" });
  console.warn = warn;
  ok("a failing webhook doesn't turn a saved edit into an error", !reply.isError, reply);
}

console.log("\ntrash_note");

{
  const { trash, inItems, inTrash, seen, log, store } = editor();
  const reply = await trash("open");
  ok("trash: moved, not deleted", !reply.isError && !inItems("open") && inTrash("open"), reply);
  ok(
    "...whole, so it can be restored",
    store.getState().notes.temporaryItems.find((n) => n.id === "open").text === "<p>body of open</p>"
  );
  ok(
    "...and the reply says which",
    JSON.parse(reply.text).id === "open" && JSON.parse(reply.text).trashed === true,
    reply.text
  );
  ok(
    "trash: webhook note/temporaryDeleteNote",
    seen.webhooks.length === 1 &&
      seen.webhooks[0].body.action === "note/temporaryDeleteNote" &&
      seen.webhooks[0].body.id === "open",
    seen.webhooks
  );
  ok("...through the trash webhook's settings", "url" in seen.webhooks[0].payload && "enabled" in seen.webhooks[0].payload);
  ok("an open editor is told", seen.notified.join() === "open", seen.notified);
  ok("flushed before answering", log.order.join() === "dispatch,flush", log.order);
  ok("pending edits committed first", log.commits === 1);

  const again = await trash("open");
  ok("trashed already: not found", again.isError && again.text === NOT_FOUND);
  const ro = await trash("ro");
  ok("trash: read-only refused", ro.isError && /read-only/.test(ro.text) && inItems("ro") && !inTrash("ro"), ro);
  for (const id of ["lockedNote", "hiddenNote", "gone", "made-up", undefined]) {
    const hidden = await trash(id);
    ok(`trash: ${id} is not found`, hidden.isError && hidden.text === NOT_FOUND, hidden);
  }
  ok(
    "trash: locked and hidden notes stay where they were",
    inItems("lockedNote") && inItems("hiddenNote") && !inTrash("lockedNote") && !inTrash("hiddenNote")
  );
  ok("(the one trashed at the start is the only webhook)", seen.webhooks.length === 1);
}
{
  let flushed = false;
  const { trash, inTrash, seen } = editor(SEED, {
    flush: async () => {
      await sleep(5);
      flushed = true;
    },
    persisted: () => !flushed,
  });
  const failed = await trash("open");
  ok(
    "trash: a failed save is an error that says it's done and not to repeat it",
    failed.isError &&
      /isn't saved to disk/.test(failed.text) &&
      /don't trash it again/i.test(failed.text) &&
      !/try again/i.test(failed.text) &&
      inTrash("open"),
    failed.text
  );
  ok("...no webhook", seen.webhooks.length === 0);
}
{
  const { call, log } = editor(SEED, { ready: () => false });
  const reply = await call("fastmemo_trash_note", { id: "open" });
  ok("trash: before the app is ready, refused", reply.isError && log.dispatched.length === 0);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Every tool                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nevery tool");

const WRITE_TOOLS = ["fastmemo_create_note", "fastmemo_set_note_flags", "fastmemo_edit_note", "fastmemo_trash_note"];
const INFO_TOOLS = ["fastmemo_help", "fastmemo_check_update"];
const READ_TOOLS = ["fastmemo_list_categories", "fastmemo_search_notes", "fastmemo_read_note"];

{
  const { read, search, log } = harness();
  await read("open");
  ok("pending edits committed before reading", log.commits === 1, log.commits);
  await search();
  ok("...and before searching", log.commits === 2, log.commits);
}
{
  // What the editor still held reaches the store in the commit: the tool must look after it, not before.
  const typed = textNote("open", 100, { text: "<p>TYPEDWORD</p>" });
  const context = {};
  const typing = harness(SEED, { commitPending: () => context.store.dispatch(N.addNote(typed)) });
  context.store = typing.store;
  ok("a read sees what was just typed", JSON.parse((await typing.read("open")).text).content === "<p>TYPEDWORD</p>");
  ok("...and so does a search", ids(await typing.search("TYPEDWORD")).join() === "open");

  const locking = {};
  const locks = harness(SEED, {
    commitPending: () => locking.store.dispatch(N.addNote(textNote("open", 100, { locked: true }))),
  });
  locking.store = locks.store;
  ok("a note locked in that commit is out of reach", (await locks.read("open")).text === NOT_FOUND);
}
{
  const { call, log } = harness(SEED, { ready: () => false });
  for (const tool of [...READ_TOOLS, ...WRITE_TOOLS, ...INFO_TOOLS]) {
    const notReady = await call(tool, { id: "open", query: "x" });
    ok(
      `still starting: ${tool} refused, nothing dispatched`,
      notReady.isError && notReady.text.includes("starting") && log.dispatched.length === 0,
      notReady
    );
  }
  ok("...and no pending edit committed", log.commits === 0, log.commits);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* help and check_update                                                                                               */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nhelp");

const { HELP_TOPICS, HELP_MOBILE_ONLY, helpText, en } = M;
const lookup = (key) => key.split(".").reduce((value, part) => value?.[part], en);
const helpDeps = {
  helpBody: (base) => {
    const value = lookup(base);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  },
  helpTitle: (key) => String(lookup(key) ?? key),
};

{
  // The help screen builds its own list inside the component: this keeps the shared one in step with it.
  const source = readFileSync(join(__dirname, "..", "app", "settings", "help.tsx"), "utf8");
  const screen = [...source.matchAll(/(catKey|base): "([^"]+)"/g)];
  const screenBases = screen.filter((m) => m[1] === "base").map((m) => m[2]);
  const screenCategory = {};
  let category = null;
  for (const [, kind, value] of screen) {
    if (kind === "catKey") category = value;
    else screenCategory[value] = category;
  }
  const listed = HELP_TOPICS.flatMap((c) => c.bases);
  const setEq = (a, b) => a.length === new Set(a).size && a.length === b.length && b.every((x) => a.includes(x));

  ok("topics match the help screen", setEq(listed.concat(HELP_MOBILE_ONLY), screenBases), [listed.length, screenBases.length]);
  ok(
    "...each under the screen's category",
    HELP_TOPICS.every((c) => c.bases.every((base) => screenCategory[base] === c.catKey))
  );
  ok("...in the screen's order", listed.join() === screenBases.filter((base) => listed.includes(base)).join());
  ok(
    "no category without a topic",
    HELP_TOPICS.every((c) => c.bases.length > 0)
  );
  ok(
    "every listed topic has a title and text in English",
    listed.every((base) => typeof lookup(base)?.title === "string" && helpText(lookup(base)).length > 0),
    listed.filter((base) => helpText(lookup(base) ?? {}).length === 0)
  );
}
{
  const { call, log } = harness(SEED, helpDeps);
  const reply = await call("fastmemo_help");
  const { topics } = JSON.parse(reply.text);
  const list = topics.map((topic) => topic.key);
  ok("no topic: the list", !reply.isError && topics.length === HELP_TOPICS.flatMap((c) => c.bases).length, reply);
  ok("no mobile-only topic listed", !list.includes("help.what_ai_assistant") && !list.includes("help.what_voice_dictation"));
  ok("desktop shortcuts listed", list.includes("help.what_desktop_shortcuts"));
  ok(
    "each entry: key, title and category",
    topics.every((topic) => topic.key.startsWith("help.") && topic.title && topic.category && topic.title !== topic.key),
    topics[0]
  );
  ok(
    "the first topic, as the screen shows it",
    topics[0].key === "help.how_to_create_note" &&
      topics[0].title === en.help.how_to_create_note.title &&
      topics[0].category === en.help.cat_notes
  );
  ok("the AI category isn't listed", !topics.some((topic) => topic.category === en.help.cat_ai));
  ok("...and nothing dispatched or sent", log.dispatched.length === 0 && log.order.length === 0 && log.commits === 0);
}
{
  const { call } = harness(SEED, helpDeps);
  const reply = await call("fastmemo_help", { topic: "help.how_to_create_note" });
  const topic = JSON.parse(reply.text);
  ok(
    "a topic: key, title and text",
    !reply.isError &&
      topic.key === "help.how_to_create_note" &&
      topic.title === en.help.how_to_create_note.title &&
      topic.text === helpText(en.help.how_to_create_note) &&
      topic.text.length > 0,
    reply
  );
  ok("...the text has no title and no i18n key", !topic.text.includes(topic.title) && !topic.text.includes("text_"));

  const toolbar = JSON.parse((await call("fastmemo_help", { topic: "help.what_toolbar_below" })).text).text.split("\n");
  const at = (word) => toolbar.findIndex((line) => line.startsWith(`• ${word}`));
  ok(
    "toolbar: the named lines sit between the numbered ones, and text_10_0 comes after text_9_0",
    at("Image") < at("Heading") &&
      at("Heading") < at("Bold") &&
      at("Underline") < at("Align left") &&
      at("Align left") < at("Subscript") &&
      at("Superscript") < at("Bullet list") &&
      toolbar.length === 14,
    toolbar
  );
  ok(
    "...the link texts are left out",
    !(await call("fastmemo_help", { topic: "help.what_webhooks" })).text.includes("guide →")
  );

  const desktop = await call("fastmemo_help", { topic: "help.what_desktop_shortcuts" });
  ok("the desktop shortcuts topic is readable", !desktop.isError && JSON.parse(desktop.text).text.length > 0, desktop);
}
{
  let asked = 0;
  const { call, log } = harness(SEED, {
    ...helpDeps,
    helpBody: (base) => {
      asked++;
      return helpDeps.helpBody(base);
    },
  });
  const refusals = {
    "a mobile-only topic": "help.what_ai_assistant",
    "voice dictation": "help.what_voice_dictation",
    "an unknown topic": "help.nope",
    "a topic without its prefix": "how_to_create_note",
    "a category key": "help.cat_notes",
    "an object key": "constructor",
    "a prototype key": "__proto__",
    "an empty topic": "",
    "a topic that isn't text": 42,
  };
  for (const [name, topic] of Object.entries(refusals)) {
    const reply = await call("fastmemo_help", { topic });
    ok(
      `${name} is refused, with the way to the list`,
      reply.isError && reply.text.includes("without a topic") && !reply.text.includes("text_"),
      reply
    );
  }
  ok("...none of them read the strings", asked === 0, asked);
  const nothing = await call("fastmemo_help", { topic: null });
  ok("a null topic lists the topics", !nothing.isError && JSON.parse(nothing.text).topics.length > 0);
  ok("...nothing dispatched", log.dispatched.length === 0);

  const empty = harness(SEED, { ...helpDeps, helpBody: () => null });
  ok("a listed topic with no strings is refused", (await empty.call("fastmemo_help", { topic: "help.what_language" })).isError);
}
{
  ok("lines in order", helpText({ title: "T", text_1_0: "a", text_1_1: "b", text_2_0: "c" }) === "a b\nc");
  ok(
    "ordered by their numbers, not the object's",
    helpText({ text_10_0: "j", text_2_0: "b", text_1_1: "a2", text_1_0: "a1", text_2_1: "b2" }) === "a1 a2\nb b2\nj"
  );
  ok(
    "values that aren't strings, and other keys, are left out",
    helpText({
      title: "T",
      text_1_0: "a",
      text_2_0: { x: "no" },
      text_3_0: ["no"],
      text_4_0: 5,
      text_link: "L",
      other: "o",
      text_1: "x",
    }) === "a"
  );
  ok("nothing to say is an empty text", helpText({ title: "T" }) === "");
  ok(
    "a named line follows its numbered one",
    helpText({ text_1_0: "a", text_heading: "h", text_4_0: "d", text_3_0: "c", text_align: "g", text_7_0: "z" }) ===
      "a\nc\nh\nd\nz\ng"
  );
}

console.log("\ncheck_update");

{
  const answers = {
    newer: { kind: "newer", current: "2.1.0", latest: "2.2.0" },
    current: { kind: "current", current: "2.1.0" },
    packageManager: { kind: "packageManager", current: "2.1.0" },
  };
  const ask = async (check, overrides = {}) => {
    const { call, log } = harness(SEED, { checkUpdate: async () => check, ...overrides });
    return { reply: await call("fastmemo_check_update"), log };
  };

  const newer = await ask(answers.newer);
  ok(
    "newer: both versions, and that it installs in the app",
    !newer.reply.isError &&
      newer.reply.text.includes("2.1.0") &&
      newer.reply.text.includes("2.2.0") &&
      newer.reply.text.includes("app"),
    newer.reply
  );
  ok("...not as up to date", !newer.reply.text.includes("up to date"));

  const current = await ask(answers.current);
  ok(
    "current: up to date, with the version",
    !current.reply.isError && current.reply.text.includes("up to date") && current.reply.text.includes("2.1.0"),
    current.reply
  );

  const pm = (await ask(answers.packageManager)).reply;
  ok("deb and rpm never read as up to date", pm.text.includes("package manager") && !pm.text.includes("up to date"), pm);
  ok("...with the version, and not an error", pm.text.includes("2.1.0") && !pm.isError);

  const warn = console.warn;
  console.warn = () => {};
  const failing = await ask(null, {
    checkUpdate: async () => {
      throw new Error("ECONNREFUSED https://updates.example/secret");
    },
  });
  console.warn = warn;
  ok("failed check is an error", failing.reply.isError && failing.reply.text.includes("couldn't check"), failing.reply);
  ok("...without what the error said", !failing.reply.text.includes("ECONNREFUSED") && !failing.reply.text.includes("secret"));

  ok(
    "it isn't a write: nothing dispatched, flushed, committed or sent",
    [newer, current].every(({ log }) => log.dispatched.length === 0 && log.order.length === 0 && log.commits === 0)
  );
}
{
  const { call } = harness();
  const reply = await call("fastmemo_nope");
  ok("an unknown tool is an error", reply.isError);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The bridge: what comes in from Rust, and what goes back                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nthe bridge");

const REQUEST_EVENT = "fastmemo://mcp-request";
const request = (id, tool = "fastmemo_list_categories", args = {}) => ({
  payload: { id, tool, args, scope: { editAll: false, ownedIds: [] } },
});

{
  const appStore = makeStore();
  appStore.dispatch(C.createCategory({ name: "Work", icon: "work" }));
  const pageState = {
    tauri: false,
    bootstrapped: false,
    notesLoaded: true,
    listeners: {},
    invoked: [],
    getState: appStore.getState,
    dispatch: appStore.dispatch,
  };
  globalThis.__page = pageState;

  M.installMcpBridge();
  await sleep(20);
  ok("outside Tauri nothing listens", pageState.listeners[REQUEST_EVENT] === undefined);

  pageState.tauri = true;
  M.installMcpBridge();
  ok("in Tauri it listens for the requests", await until(() => pageState.listeners[REQUEST_EVENT] !== undefined));
  M.installMcpBridge();
  M.installMcpBridge();
  await sleep(20);
  ok("installed again (a Fast Refresh): one listener is left", pageState.listens - (pageState.unlistened ?? 0) === 1, [
    pageState.listens,
    pageState.unlistened,
  ]);
  const send = pageState.listeners[REQUEST_EVENT];
  const replyTo = async (id) => {
    await until(() => pageState.invoked.some((call) => call.args.id === id));
    return pageState.invoked.find((call) => call.args.id === id);
  };

  send(request(1));
  const early = await replyTo(1);
  ok(
    "before the store has rehydrated: the refusal, sent back",
    early.command === "mcp_reply" && early.args.reply.isError && early.args.reply.text.includes("starting"),
    early
  );

  pageState.bootstrapped = true;
  pageState.notesLoaded = false;
  send(request(2));
  ok("with the notes not read: the refusal too", (await replyTo(2)).args.reply.isError);

  pageState.notesLoaded = true;
  send(request(3));
  const answer = await replyTo(3);
  ok(
    "rehydrated: the answer goes back under the request's id",
    answer.command === "mcp_reply" && !answer.args.reply.isError,
    answer
  );
  ok("...and it's what the store holds", JSON.parse(answer.args.reply.text).categories.join() === "Work");

  send(request(4, "fastmemo_read_note", { id: "lockedNote" }));
  ok("the real state's locked note is unknown through the bridge", (await replyTo(4)).args.reply.text === NOT_FOUND);

  const warn = console.warn;
  console.warn = () => {};
  pageState.getState = () => {
    throw new Error("BROKENSTATE");
  };
  send(request(5));
  const broken = await replyTo(5);
  console.warn = warn;
  ok(
    "a page error still gets a reply, as an error",
    broken.args.reply.isError === true && typeof broken.args.reply.text === "string",
    broken
  );
  ok("...without what the error said", !broken.args.reply.text.includes("BROKENSTATE"), broken.args.reply.text);

  // The tools that read the app's version and its help strings, through the bridge's own wiring.
  pageState.getState = appStore.getState;
  pageState.version = "2.1.0";
  pageState.bundleType = "appimage";
  pageState.checked = 0;
  pageState.update = null;
  pageState.checkError = null;
  pageState.checkDesktopUpdate = async () => {
    pageState.checked++;
    if (pageState.checkError) throw pageState.checkError;
    return pageState.update;
  };
  pageState.t = (key) => key.split(".").reduce((value, part) => value?.[part], M.en) ?? key;
  let next = 100;
  const tool = async (name, args = {}) => {
    const id = next++;
    send(request(id, name, args));
    return (await replyTo(id)).args.reply;
  };
  const updateWith = (close) => ({ version: "2.2.0", close });

  let closed = 0;
  pageState.update = updateWith(async () => {
    closed++;
  });
  const newer = await tool("fastmemo_check_update");
  ok(
    "bridge: a newer version, both versions said",
    !newer.isError && newer.text.includes("2.1.0") && newer.text.includes("2.2.0"),
    newer
  );
  ok("...and the update released", closed === 1, closed);

  closed = 0;
  pageState.update = updateWith(async () => {
    closed++;
    throw new Error("CLOSEFAILED");
  });
  const unclosed = await tool("fastmemo_check_update");
  ok(
    "a close that fails doesn't fail the check",
    closed === 1 && !unclosed.isError && unclosed.text.includes("2.2.0"),
    unclosed
  );

  closed = 0;
  pageState.update = updateWith(() => {
    closed++;
    throw new Error("CLOSEFAILED");
  });
  const unclosedSync = await tool("fastmemo_check_update");
  ok("...nor one that throws at once", closed === 1 && !unclosedSync.isError, unclosedSync);

  pageState.update = null;
  const current = await tool("fastmemo_check_update");
  ok(
    "no update: up to date",
    !current.isError && current.text.includes("up to date") && current.text.includes("2.1.0"),
    current
  );

  for (const bundle of ["deb", "rpm"]) {
    pageState.bundleType = bundle;
    pageState.checked = 0;
    pageState.update = updateWith(async () => {});
    const managed = await tool("fastmemo_check_update");
    ok(
      `${bundle}: the package manager, never up to date`,
      managed.text.includes("package manager") && !managed.text.includes("up to date") && !managed.isError,
      managed
    );
    ok(`...${bundle} doesn't ask the updater`, pageState.checked === 0, pageState.checked);
  }
  pageState.bundleType = "appimage";

  const warnUpdate = console.warn;
  console.warn = () => {};
  pageState.checkError = new Error("NETWORKDOWN");
  const failed = await tool("fastmemo_check_update");
  pageState.checkError = null;
  console.warn = warnUpdate;
  ok("a failed check is an error", failed.isError && failed.text.includes("couldn't check"), failed);
  ok("...without what the error said", !failed.text.includes("NETWORKDOWN"), failed.text);

  const topics = await tool("fastmemo_help");
  ok(
    "bridge: the topics, from the app's strings",
    !topics.isError && JSON.parse(topics.text).topics.some((topic) => topic.key === "help.what_desktop_shortcuts"),
    topics
  );
  const topic = JSON.parse((await tool("fastmemo_help", { topic: "help.how_to_create_note" })).text);
  ok(
    "...a topic's text",
    topic.title === M.en.help.how_to_create_note.title && topic.text === helpText(M.en.help.how_to_create_note),
    topic
  );
  ok("...and a mobile-only one refused", (await tool("fastmemo_help", { topic: "help.what_ai_assistant" })).isError);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
