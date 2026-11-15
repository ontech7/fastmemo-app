// The copy of a note (spec A.4): a new note that shares nothing with the original, with the flags the spec gives.
// Run: node scripts/note-copy.test.mjs

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "note-copy.bundle.mjs");

await build({
  stdin: { contents: `export * from "@/libs/noteCopy";`, resolveDir: srcDir, loader: "ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": srcDir },
});
const { copyOfNote } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  }
};

console.log("\n=== The copy of a note ===");
let n = 0;
const fresh = { id: "new", now: 5000, date: "D", newId: () => "x" + ++n, untitled: "Senza titolo" };
const src = {
  id: "a",
  type: "todo",
  title: "Spesa",
  category: { icon: "home", name: "Casa" },
  date: "old",
  createdAt: 1,
  updatedAt: 2,
  important: true,
  locked: true,
  readOnly: true,
  hidden: true,
  local: true,
  deleteDate: null,
  rev: 9,
  syncedRev: 9,
  remindAt: 99,
  mode: "steps",
  hideDone: true,
  list: [
    { id: "1", text: "Latte", checked: true },
    { id: "2", text: "Pane", checked: false },
  ],
};
const copy = copyOfNote(src, fresh);
ok(
  "new id, title with (2), dates",
  copy.id === "new" && copy.title === "Spesa (2)" && copy.createdAt === 5000 && copy.updatedAt === 5001 && copy.date === "D"
);
ok(
  "keeps what guards it and where it lives",
  copy.locked && copy.hidden && copy.local && copy.category.icon === "home" && copy.mode === "steps" && copy.hideDone === true
);
ok(
  "drops what belonged to the original",
  !copy.important && !copy.readOnly && !("rev" in copy) && !("syncedRev" in copy) && !("remindAt" in copy)
);
ok(
  "items: same text and ticks, new ids, nothing shared",
  copy.list.map((i) => i.text + i.checked).join() === "Lattetrue,Panefalse" &&
    copy.list.every((i, k) => i.id !== src.list[k].id && i !== src.list[k]) &&
    copy.list !== src.list &&
    copy.category !== src.category
);
const kb = copyOfNote(
  {
    ...src,
    type: "kanban",
    list: undefined,
    columns: [{ id: "c", name: "Da fare", color: "#fff", items: [{ id: "k", text: "Uno" }] }],
  },
  fresh
);
ok(
  "a board's columns and cards get new ids",
  kb.columns[0].id !== "c" &&
    kb.columns[0].items[0].id !== "k" &&
    kb.columns[0].items[0].text === "Uno" &&
    kb.columns[0].color === "#fff"
);
const cd = copyOfNote(
  {
    ...src,
    type: "code",
    list: undefined,
    tabs: [
      { id: "t1", title: "a", code: "1", language: "js" },
      { id: "t2", title: "b", code: "2", language: "js" },
    ],
    activeTabId: "t2",
  },
  fresh
);
ok("a code note's active tab follows", cd.tabs[1].id !== "t2" && cd.activeTabId === cd.tabs[1].id);
ok(
  "a text note",
  copyOfNote({ ...src, type: "text", list: undefined, text: "<div>ciao</div>" }, fresh).text === "<div>ciao</div>"
);
ok(
  'an untitled note\'s copy is named after the placeholder: "Senza titolo (2)", not identical to the original in the list',
  copyOfNote({ ...src, title: "" }, fresh).title === "Senza titolo (2)" &&
    copyOfNote({ ...src, title: "   " }, fresh).title === "Senza titolo (2)"
);
ok("an unknown type is not copied", copyOfNote({ ...src, type: "board" }, fresh) === null);
ok("the original is untouched", src.list[0].id === "1" && src.title === "Spesa" && src.rev === 9);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
