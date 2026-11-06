// The local MCP server's page side: what an agent may reach, and how each tool answers. This filter is the only barrier
// protecting locked and hidden notes (locked is a flag the UI enforces, not encryption), so it's tested through the tools.
// Run: node scripts/mcp.test.mjs
// It bundles the handlers and the bridge with the real notes, categories and settings slices (native-only imports stubbed).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
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
  "@/libs/flushOnExit": `export const flushNow = () => Promise.resolve();`,
  "@/libs/net": `export const postWebhook = async () => {};`,
  "@/utils/date": `export const formatDateTime = () => "today";`,
  "@/utils/platform": `export const isTauri = () => globalThis.__page.tauri;`,
  "@tauri-apps/api/event": `export const listen = async (name, handler) => { globalThis.__page.listeners[name] = handler; return () => {}; };`,
  "@tauri-apps/api/core": `export const invoke = async (command, args) => { globalThis.__page.invoked.push({ command, args }); };`,
  "react-native": `export const Platform = { OS: "web" };`,
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
      export { installMcpBridge } from "@/libs/mcp/bridge.web";
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
const { notes: N, categories: C, settings: S, policy: P, view: V } = M;
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
  const log = { commits: 0, dispatched: [] };
  const deps = {
    getState: store.getState,
    dispatch: (action) => {
      log.dispatched.push(action);
      store.dispatch(action);
    },
    commitPending: () => {
      log.commits++;
    },
    flush: async () => {},
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
  const call = (tool, args = {}) => M.handleMcpRequest({ id: 1, tool, args, scope: { editAll: false, ownedIds: [] } }, deps);
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
/* Every tool                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nevery tool");

const LATER_TOOLS = [
  "fastmemo_create_note",
  "fastmemo_set_note_flags",
  "fastmemo_help",
  "fastmemo_check_update",
  "fastmemo_edit_note",
  "fastmemo_trash_note",
];
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
  for (const tool of [...READ_TOOLS, ...LATER_TOOLS]) {
    const notReady = await call(tool, { id: "open", query: "x" });
    ok(
      `still starting: ${tool} refused, nothing dispatched`,
      notReady.isError && notReady.text.includes("starting") && log.dispatched.length === 0,
      notReady
    );
  }
  ok("...and no pending edit committed", log.commits === 0, log.commits);
}
{
  const { call, log } = harness();
  for (const tool of LATER_TOOLS) {
    const reply = await call(tool, { id: "open" });
    ok(`${tool}: not available yet`, reply.isError && reply.text === "Not available yet.", reply);
  }
  ok("...and nothing dispatched", log.dispatched.length === 0);
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
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
