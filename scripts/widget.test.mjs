// What a widget shows (spec D.6): the small copy of the chosen note it gets, never the note, and the texts and links it
// draws. Pure modules, bundled with esbuild.
// Run: node scripts/widget.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "widget.bundle.mjs");

await build({
  stdin: {
    contents: `export * from "@/libs/widget/snapshot";`,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
});

const { widgetSnapshot, canFeature, widgetState, WIDGET_LINES, WIDGET_LINE_MAX } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? `: ${detail}` : ""}`);
  }
};
const texts = (snapshot) => snapshot.lines.map((line) => line.text).join("|");

console.log("\nthe copy of the note");
const base = { id: "n", title: "Spesa", locked: false, hidden: false, deleteDate: null };
const todo = {
  ...base,
  type: "todo",
  list: [
    { id: "1", text: "Latte", checked: true },
    { id: "2", text: "Uova", checked: false },
  ],
};
ok(
  "a list: items with their boxes",
  JSON.stringify(widgetSnapshot(todo)) ===
    JSON.stringify({
      noteId: "n",
      type: "todo",
      title: "Spesa",
      lines: [
        { text: "Latte", box: "done" },
        { text: "Uova", box: "empty" },
      ],
      more: 0,
    })
);
ok("a list that hides its done items", texts(widgetSnapshot({ ...todo, hideDone: true })) === "Uova");
ok(
  "six lines at most, the rest counted",
  (() => {
    const s = widgetSnapshot({
      ...todo,
      list: Array.from({ length: 9 }, (_, i) => ({ id: "" + i, text: "v" + i, checked: false })),
    });
    return WIDGET_LINES === 6 && s.lines.length === 6 && s.more === 3;
  })()
);
ok(
  "a long line is cut",
  (() => {
    const line = widgetSnapshot({ ...base, type: "text", text: "<div>" + "a".repeat(200) + "</div>" }).lines[0].text;
    return WIDGET_LINE_MAX === 80 && line.length === 81 && line.endsWith("…");
  })()
);
ok(
  "a line of 80 characters is whole",
  widgetSnapshot({ ...base, type: "text", text: "<div>" + "a".repeat(80) + "</div>" }).lines[0].text === "a".repeat(80)
);
ok(
  "a text note: its lines, a checkbox line with its box",
  JSON.stringify(
    widgetSnapshot({
      ...base,
      type: "text",
      text: '<h1>Titolo</h1><ol class="x-todo"><li><span contenteditable="false" class="x-todo-box"><input type="checkbox" checked=""></span>fatto</li></ol>',
    }).lines
  ) === JSON.stringify([{ text: "Titolo" }, { text: "fatto", box: "done" }])
);
ok(
  "a text note's code block lines are mono",
  JSON.stringify(widgetSnapshot({ ...base, type: "text", text: "<div>prima</div><pre>x = 1</pre>" }).lines) ===
    JSON.stringify([{ text: "prima" }, { text: "x = 1", mono: true }])
);
ok(
  "a board: columns and counts",
  widgetSnapshot({
    ...base,
    type: "kanban",
    columns: [
      {
        id: "c",
        name: "Da fare",
        color: "",
        items: [
          { id: "k", text: "x" },
          { id: "j", text: "y" },
        ],
      },
    ],
  }).lines[0].text === "Da fare · 2"
);
ok(
  "a code note: the open tab, mono",
  (() => {
    const s = widgetSnapshot({
      ...base,
      type: "code",
      activeTabId: "b",
      tabs: [
        { id: "a", title: "a", code: "no", language: "js" },
        { id: "b", title: "b", code: "uno\ndue", language: "js" },
      ],
    });
    return texts(s) === "uno|due" && s.lines.every((l) => l.mono);
  })()
);
ok(
  "a code line keeps its indentation, empty lines are skipped",
  texts(
    widgetSnapshot({
      ...base,
      type: "code",
      activeTabId: "a",
      tabs: [{ id: "a", title: "a", code: "def f():\n\n    return 1  \n", language: "py" }],
    })
  ) === "def f():|    return 1"
);
ok(
  "an open tab that names no tab: the first",
  texts(
    widgetSnapshot({
      ...base,
      type: "code",
      activeTabId: "gone",
      tabs: [
        { id: "a", title: "a", code: "primo", language: "js" },
        { id: "b", title: "b", code: "secondo", language: "js" },
      ],
    })
  ) === "primo"
);
ok(
  "a list item with line breaks gives its first line; empty items are skipped",
  texts(
    widgetSnapshot({
      ...todo,
      list: [
        { id: "1", text: "\n  riga uno\nriga due", checked: false },
        { id: "2", text: "  ", checked: false },
        { id: "3", text: "tre", checked: false },
      ],
    })
  ) === "riga uno|tre"
);
ok("the title as it is, even empty", widgetSnapshot({ ...todo, title: "" }).title === "");
ok("a note with no deleteDate is live", widgetSnapshot({ ...todo, deleteDate: undefined }) !== null);
ok(
  "never a protected, hidden, trashed, unknown or missing note",
  [
    { ...todo, locked: true },
    { ...todo, hidden: true },
    { ...todo, deleteDate: 5 },
    { ...todo, type: "board" },
    undefined,
  ].every((n) => widgetSnapshot(n) === null && !canFeature(n))
);
ok("a protected note's words are nowhere", JSON.stringify(widgetSnapshot({ ...todo, locked: true })) === "null");

console.log("\nwhat the widget draws");
const t = (key) => `[${key}]`;
const state = widgetState(todo, t, "fastmemoapptest");
ok(
  "the texts in the app's language",
  JSON.stringify(state.labels) ===
    JSON.stringify({
      newNote: "[widget.new_note]",
      newList: "[widget.new_list]",
      dictate: "[widget.dictate]",
      emptyTitle: "[widget.empty_title]",
      emptyText: "[widget.empty_text]",
      noTitle: "[empty_title]",
    })
);
ok(
  "the links, made as the shortcuts' are",
  JSON.stringify(state.links) ===
    JSON.stringify({
      newText: "fastmemoapptest://launch/new/text",
      newList: "fastmemoapptest://launch/new/todo",
      dictate: "fastmemoapptest://launch/dictate",
      note: "fastmemoapptest://launch/note/n",
      app: "fastmemoapptest://",
    })
);
ok("the chosen note's copy", state.featured?.noteId === "n" && state.featured.lines.length === 2);
const none = widgetState({ ...todo, hidden: true }, t, "fastmemoapptest");
ok("a note it must not show: no copy, no link to it", none.featured === null && none.links.note === null);
ok("no note chosen", widgetState(undefined, t, "x").featured === null);

console.log("\nwhat the app writes for the widgets");
{
  // startWidget with a store, its storage and the library stood in for: what is written, and when.
  const outLive = join(os.tmpdir(), "widget-live.bundle.mjs");
  const stub = (filter, contents) => ({
    name: `stub-${filter}`,
    setup(b) {
      b.onResolve({ filter }, () => ({ path: String(filter), namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (args) =>
        args.path === String(filter) ? { contents, loader: "js" } : undefined
      );
    },
  });
  await build({
    stdin: {
      contents: `export { startWidget, readWidgetState } from "@/libs/widget"; export { WIDGETS } from "@/widgets/registry";`,
      resolveDir: src,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outLive,
    logLevel: "error",
    alias: { "@": src },
    define: { "process.env.EXPO_PUBLIC_ENV": '"DEV"' },
    plugins: [
      stub(
        /^@react-native-async-storage\/async-storage$/,
        "const m = (globalThis.__kv = new Map()); export default { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); globalThis.__writes = (globalThis.__writes ?? 0) + 1; } };"
      ),
      // the widgets themselves draw with the app's styles (react-native): a registry the test fills
      stub(/widgets\/registry$/, "export const WIDGETS = {};"),
      stub(
        /^react-native-android-widget$/,
        "export const requestWidgetUpdate = async ({ widgetName, renderWidget }) => { (globalThis.__drawn ??= []).push([widgetName, renderWidget()]); };"
      ),
    ],
  });
  const { startWidget, readWidgetState, WIDGETS } = await import(pathToFileURL(outLive).href);
  WIDGETS.Test = (state) => state;

  let state = { notes: { items: [todo] }, settings: { widgetNoteId: null } };
  const listeners = new Set();
  const store = {
    getState: () => state,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  };
  const set = (next) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const stored = () => JSON.parse(globalThis.__kv.get("@widgetState"));

  const stop = startWidget(store);
  await settle();
  ok("at the start: written, no note chosen", stored().featured === null && globalThis.__writes === 1);
  set({ ...state, settings: { widgetNoteId: "n" } });
  await settle();
  ok(
    "a note chosen: its copy is written and the widgets redrawn",
    stored().featured?.title === "Spesa" && globalThis.__drawn.at(-1)[0] === "Test"
  );
  set({ ...state, notes: { items: [{ ...todo, title: "Spesa di sabato" }] } });
  await settle();
  ok("the note edited: the copy follows", stored().featured.title === "Spesa di sabato");
  const writes = globalThis.__writes;
  set({ ...state, notes: { items: [...state.notes.items, { ...base, id: "other", type: "text", text: "<div>x</div>" }] } });
  await settle();
  ok("another note changed: nothing written", globalThis.__writes === writes);
  set({ ...state, notes: { items: [{ ...state.notes.items[0], locked: true }, state.notes.items[1]] } });
  await settle();
  ok(
    "the note protected: no copy, none of its words stored",
    stored().featured === null && !globalThis.__kv.get("@widgetState").includes("Latte")
  );
  ok("the choice is kept for when it can be shown again", state.settings.widgetNoteId === "n");
  ok(
    "what the widget reads is what was written",
    JSON.stringify(await readWidgetState()) === globalThis.__kv.get("@widgetState")
  );
  stop();
  const before = globalThis.__writes;
  set({ ...state, notes: { items: [{ ...state.notes.items[0], locked: false }, state.notes.items[1]] } });
  await settle();
  ok("stopped: nothing more written", globalThis.__writes === before);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
