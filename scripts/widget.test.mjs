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

const {
  widgetSnapshot,
  canFeature,
  widgetState,
  WIDGET_LINES,
  WIDGET_LINE_MAX,
  WIDGET_TEXT_LINES,
  WIDGET_TEXT_MAX,
  WIDGET_COLUMNS,
  WIDGET_CARDS,
  WIDGET_CARD_MAX,
} = await import(pathToFileURL(out).href);

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
  "a long list item is cut",
  (() => {
    const line = widgetSnapshot({ ...todo, list: [{ id: "1", text: "a".repeat(200), checked: false }] }).lines[0].text;
    return WIDGET_LINE_MAX === 80 && line.length === 81 && line.endsWith("…");
  })()
);
ok(
  "a list item of 80 characters is whole",
  widgetSnapshot({ ...todo, list: [{ id: "1", text: "a".repeat(80), checked: false }] }).lines[0].text === "a".repeat(80)
);
ok(
  "a text note's paragraph is whole: the widget wraps it",
  widgetSnapshot({ ...base, type: "text", text: "<div>" + "a".repeat(300) + "</div>" }).lines[0].text === "a".repeat(300)
);
ok(
  "a text note's paragraph is cut only past its own limit",
  (() => {
    const line = widgetSnapshot({ ...base, type: "text", text: "<div>" + "a".repeat(900) + "</div>" }).lines[0].text;
    return WIDGET_TEXT_MAX === 400 && line.length === 401 && line.endsWith("…");
  })()
);
ok(
  "a text note keeps more paragraphs than a list keeps items",
  (() => {
    const s = widgetSnapshot({
      ...base,
      type: "text",
      text: Array.from({ length: 15 }, (_, i) => `<div>riga ${i}</div>`).join(""),
    });
    return WIDGET_TEXT_LINES === 12 && s.lines.length === 12 && s.more === 3;
  })()
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
  "a board: its columns, each with its colour, count and first cards",
  (() => {
    const s = widgetSnapshot({
      ...base,
      type: "kanban",
      columns: [
        {
          id: "c",
          name: "Da fare",
          color: "#799EDC",
          items: [
            { id: "k", text: "x\nsotto" },
            { id: "j", text: "y" },
          ],
        },
      ],
    });
    return (
      JSON.stringify(s.columns) === JSON.stringify([{ name: "Da fare", color: "#799EDC", count: 2, cards: ["x", "y"] }]) &&
      s.lines.length === 0 &&
      s.more === 0
    );
  })()
);
ok(
  "a board: at most 4 columns of 3 cards, a card cut at 60, the other columns counted",
  (() => {
    const column = (i) => ({
      id: "c" + i,
      name: "C" + i,
      color: "#A7ABB9",
      items: Array.from({ length: 5 }, (_, j) => ({ id: `${i}-${j}`, text: j === 0 ? "b".repeat(100) : "card " + j })),
    });
    const s = widgetSnapshot({ ...base, type: "kanban", columns: Array.from({ length: 6 }, (_, i) => column(i)) });
    return (
      WIDGET_COLUMNS === 4 &&
      WIDGET_CARDS === 3 &&
      WIDGET_CARD_MAX === 60 &&
      s.columns.length === 4 &&
      s.more === 2 &&
      s.columns[0].count === 5 &&
      s.columns[0].cards.length === 3 &&
      s.columns[0].cards[0] === "b".repeat(60) + "…"
    );
  })()
);
ok(
  "a board's column with no name, a colour that isn't one, empty cards skipped",
  JSON.stringify(
    widgetSnapshot({
      ...base,
      type: "kanban",
      columns: [
        {
          id: "c",
          name: "  ",
          color: "red; x",
          items: [
            { id: "k", text: " " },
            { id: "j", text: "z" },
          ],
        },
      ],
    }).columns
  ) === JSON.stringify([{ name: "", color: "", count: 2, cards: ["z"] }])
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
      contents: `export { startWidget, readWidgetState } from "@/libs/widget"; export { WIDGETS } from "@/widgets/registry"; export { widgetTask } from "@/widgets/taskHandler";`,
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
      // the phone in Italian; react-i18next's hook-up is the app's, not the widget's
      stub(/^expo-localization$/, "export const getLocales = () => [{ languageCode: 'it' }];"),
      stub(/^react-i18next$/, "export const initReactI18next = { type: '3rdParty', init() {} };"),
      stub(
        /^react-native-android-widget$/,
        "export const requestWidgetUpdate = async ({ widgetName, renderWidget }) => { (globalThis.__drawn ??= []).push([widgetName, renderWidget()]); };" +
          " export const requestWidgetUpdateById = async ({ widgetName, widgetId, renderWidget }) => { (globalThis.__drawnById ??= []).push([widgetName, widgetId, renderWidget({ widgetName, widgetId, width: 200, height: 120 })]); };"
      ),
    ],
  });
  const { startWidget, readWidgetState, WIDGETS, widgetTask } = await import(pathToFileURL(outLive).href);
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

  // With the app closed: the launcher's event, as the library hands it to the background task.
  const event = (widgetAction, widgetName = "Test") => ({ widgetAction, widgetName, widgetId: 7, width: 200, height: 120 });
  await widgetTask(event("WIDGET_UPDATE"));
  const drawn = globalThis.__drawnById?.at(-1);
  ok(
    "a widget's event with the app closed: that widget redrawn from the stored state",
    drawn?.[0] === "Test" && drawn[1] === 7 && JSON.stringify(drawn[2]) === globalThis.__kv.get("@widgetState")
  );
  const count = globalThis.__drawnById.length;
  await widgetTask(event("WIDGET_DELETED"));
  await widgetTask(event("WIDGET_CLICK"));
  await widgetTask(event("WIDGET_UPDATE", "Unknown"));
  ok("a removed widget, a click, an unknown widget: nothing drawn", globalThis.__drawnById.length === count);

  // Placed before the app ever reached the home (a fresh install, cleared data): no state stored, and nothing but the
  // background task has run, so the labels come from the phone's language through the app's own i18n.
  globalThis.__kv.clear();
  await widgetTask(event("WIDGET_ADDED"));
  const first = globalThis.__drawnById.at(-1)?.[2];
  ok(
    "added before the app ever ran: its labels in the phone's language",
    first?.featured === null &&
      first.labels.newList === "Nuova lista" &&
      Object.values(first.labels).every((v) => typeof v === "string" && v),
    JSON.stringify(first?.labels)
  );
}

console.log("\nwhat the widgets draw");
{
  // The widgets built into the tree the library hands to Android (its own buildWidgetTree), for every kind of note and
  // size: a part it can't draw (a fragment, a component returning several) throws here as it did on the phone.
  const outDraw = join(os.tmpdir(), "widget-draw.bundle.mjs");
  await build({
    stdin: {
      contents: `export { WIDGETS } from "@/widgets/registry"; export { widgetState } from "@/libs/widget/snapshot";
        export { buildWidgetTree } from "react-native-android-widget/lib/module/api/build-widget-tree";`,
      resolveDir: src,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outDraw,
    logLevel: "error",
    alias: { "@": src },
    jsx: "automatic",
    loader: { ".tsx": "tsx" },
    plugins: [
      {
        name: "stub-react-native",
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({ path: "rn", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents:
              "export const Platform = { OS: 'ios', select: (o) => o.android ?? o.default }; export const NativeModules = {}; export const TurboModuleRegistry = { get: () => null }; export const StyleSheet = { create: (x) => x, hairlineWidth: 1 }; export const Image = { resolveAssetSource: () => ({ uri: '' }) }; export const Dimensions = { get: () => ({ width: 400, height: 800 }) };",
            loader: "js",
          }));
        },
      },
    ],
  });
  const D = await import(pathToFileURL(outDraw).href);
  const t = (key) => key;
  const board = {
    ...base,
    type: "kanban",
    columns: [0, 1, 2, 3, 4].map((i) => ({
      id: "c" + i,
      name: "C" + i,
      color: "#799EDC",
      items: [{ id: "k" + i, text: "card " + i }],
    })),
  };
  const notes = {
    text: {
      ...base,
      type: "text",
      text: '<div>uno</div><ol class="x-todo"><li><input type="checkbox">due</li></ol><pre>x = 1</pre><div>tre</div>',
    },
    todo,
    kanban: board,
    code: { ...base, type: "code", activeTabId: "a", tabs: [{ id: "a", title: "a", code: "a\nb", language: "js" }] },
    none: undefined,
  };
  const sizes = [undefined, { width: 180, height: 110 }, { width: 400, height: 400 }, { width: 120, height: 60 }];
  const failures = [];
  for (const [kind, note] of Object.entries(notes)) {
    for (const size of sizes) {
      for (const name of Object.keys(D.WIDGETS)) {
        try {
          const tree = D.buildWidgetTree(D.WIDGETS[name](D.widgetState(note, t, "fastmemoapptest"), size));
          if (!tree?.type) failures.push(`${name}/${kind}: no tree`);
        } catch (error) {
          failures.push(`${name}/${kind}/${size ? size.width : "none"}: ${error.message}`);
        }
      }
    }
  }
  ok("every widget builds for every kind of note and size", failures.length === 0, failures.slice(0, 3).join(" | "));
}

console.log("\nthe key the system wakes the app with");
{
  // register.ts names the library's headless task itself (the library stays unloaded at start): the same key as the
  // library's Android worker, or widgets stop redrawing with the app closed.
  const { readFileSync } = await import("node:fs");
  const ours = /WIDGET_TASK = "([^"]+)"/.exec(readFileSync(join(src, "libs/widget/register.ts"), "utf8"))?.[1];
  const worker = readFileSync(
    join(
      __dirname,
      "..",
      "node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidgetBackgroundTaskWorker.java"
    ),
    "utf8"
  );
  ok("the app registers the key the library's worker starts", !!ours && worker.includes(`"${ours}"`), ours);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
