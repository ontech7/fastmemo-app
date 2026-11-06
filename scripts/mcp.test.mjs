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
      export { KANBAN_COLUMN_COLORS } from "@/constants/styles";
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
/* Every tool                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\nevery tool");

const WRITE_TOOLS = ["fastmemo_create_note", "fastmemo_set_note_flags"];
const LATER_TOOLS = ["fastmemo_help", "fastmemo_check_update", "fastmemo_edit_note", "fastmemo_trash_note"];
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
  for (const tool of [...READ_TOOLS, ...WRITE_TOOLS, ...LATER_TOOLS]) {
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
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
