// The history of a note's versions (spec B.9): what is kept and when, the limits (20 a note, 5 MB a note, 200 MB in
// all), and the store over a backend of named values. src/libs/history/limits.ts and store.ts, pure of the app.
// Run: node scripts/history.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const out = join(os.tmpdir(), "history.bundle.mjs");
await build({
  stdin: {
    contents: `export * from "@/libs/history/limits"; export * from "@/libs/history/store";`,
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
const { idsToSweep, shouldKeep, toDropForNote, toDropForTotal, bodyOf, withBody, replacedByPlan, createHistory } = await import(
  pathToFileURL(out).href
);

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

console.log("\n=== When a version is kept, and which go ===");
const MIN = 60000;
const meta = (id, at, reason = "edit", size = 1000, hash = id) => ({ id, noteId: "n", at, reason, size, hash });
ok("the first version is kept", shouldKeep([], { at: 0, reason: "ai", hash: "h" }));
ok("identical to the newest: no", !shouldKeep([meta("a", 0, "ai", 1, "h")], { at: 20 * MIN, reason: "sync", hash: "h" }));
ok("same reason within 10 minutes: no", !shouldKeep([meta("a", 0, "ai")], { at: 10 * MIN - 1, reason: "ai", hash: "x" }));
ok("same reason after 10 minutes: yes", shouldKeep([meta("a", 0, "ai")], { at: 10 * MIN, reason: "ai", hash: "x" }));
ok(
  "another reason within 10 minutes: yes",
  ["agent", "sync", "replace", "cleanup", "restore"].every((r) =>
    shouldKeep([meta("a", 0, "ai")], { at: MIN, reason: r, hash: "x" })
  )
);
ok(
  "a second restore, replace-all or delete-completed within 10 minutes: the text since is kept",
  ["restore", "replace", "cleanup"].every((r) =>
    shouldKeep([meta("b", 5 * MIN, "edit"), meta("a", 0, r)], { at: 6 * MIN, reason: r, hash: "x" })
  ) && !shouldKeep([meta("a", 0, "restore", 1, "h")], { at: MIN, reason: "restore", hash: "h" })
);
ok(
  "the sweep: the ids of live and trashed notes",
  [...idsToSweep({ items: [{ id: "a" }], temporaryItems: [{ id: "t" }] }, true)].join() === "a,t"
);
ok(
  "no sweep after a failed notes read, nor from an empty store (every version would look orphaned)",
  idsToSweep({ items: [{ id: "a" }], temporaryItems: [] }, false) === null &&
    idsToSweep({ items: [], temporaryItems: [] }, true) === null
);
ok(
  "the reason's own newest counts",
  !shouldKeep([meta("b", 5 * MIN, "sync"), meta("a", 0, "ai")], { at: 9 * MIN, reason: "ai", hash: "x" })
);
ok(
  "'edit' waits 10 minutes from the newest of any reason",
  !shouldKeep([meta("a", 0, "ai")], { at: 9 * MIN, reason: "edit", hash: "x" }) &&
    shouldKeep([meta("a", 0, "ai")], { at: 10 * MIN, reason: "edit", hash: "x" })
);
ok("the 21st goes", toDropForNote(Array.from({ length: 21 }, (_, i) => meta("v" + i, 1000 - i))).join() === "v20");
ok(
  "over 5 MB the oldest go",
  toDropForNote([meta("a", 3, "edit", 3e6), meta("b", 2, "edit", 2e6), meta("c", 1, "edit", 1e6)]).join() === "c"
);
ok("the newest stays whatever its size", toDropForNote([meta("a", 2, "edit", 9e6), meta("b", 1, "edit", 10)]).join() === "b");
const big = (id, noteId, at) => ({ id, noteId, at, reason: "edit", size: 60 * 1024 * 1024, hash: id });
ok(
  "over 200 MB in all, the oldest anywhere goes",
  toDropForTotal([big("a2", "a", 4), big("a1", "a", 1), big("b2", "b", 3), big("b1", "b", 2)])
    .map((v) => v.id)
    .join() === "a1"
);

console.log("\n=== What a version holds ===");
const note = (text, extra = {}) => ({
  id: "n",
  type: "text",
  title: "T",
  text,
  important: false,
  category: { icon: "work" },
  rev: 1,
  ...extra,
});
ok(
  "a body is title and content only",
  JSON.stringify(bodyOf(note("uno", { important: true, rev: 7, hidden: true }))) ===
    JSON.stringify({ type: "text", title: "T", text: "uno" })
);
const todo = {
  id: "l",
  type: "todo",
  title: "L",
  mode: "steps",
  hideDone: true,
  list: [{ id: "1", text: "a", checked: true }],
  important: true,
};
ok(
  "a list's body",
  JSON.stringify(bodyOf(todo)) === JSON.stringify({ type: "todo", title: "L", list: todo.list, mode: "steps" })
);
const back = withBody({ ...note("ora"), important: true, title: "Nuovo" }, bodyOf(note("prima")));
ok(
  "restored: old title and content, today's flags",
  back.text === "prima" && back.title === "T" && back.important === true && back.rev === 1
);
ok("another type can't be put back", withBody(note("x"), bodyOf(todo)) === null);
ok(
  "a list's mode the version didn't have goes",
  !("mode" in withBody({ ...todo, mode: "steps" }, { type: "todo", title: "L", list: [] }))
);
ok(
  "what a sync replaces",
  replacedByPlan(
    [note("a"), { ...note("b"), id: "m" }, { ...note("c"), id: "k" }],
    [note("a", { rev: 9, important: true }), { ...note("B"), id: "m" }, { ...note("z"), id: "new" }]
  )
    .map((x) => x.id)
    .join() === "m"
);

console.log("\n=== The store ===");
const mem = () => {
  const m = new Map();
  return {
    m,
    list: async () => [...m.keys()],
    read: async (k) => m.get(k) ?? null,
    write: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
    clear: async () => m.clear(),
  };
};
let now = 0;
const be = mem();
const h = createHistory(be, () => now);
ok(
  "keep stores a body",
  (await h.keep(note("uno"), "ai")) === true && (await h.read("n", (await h.list("n"))[0].id)).text === "uno"
);
now = MIN;
ok("a burst of the same reason adds nothing", (await h.keep(note("due"), "ai")) === false);
ok("another reason does", (await h.keep(note("due"), "agent")) === true);
now = 30 * MIN;
ok("identical to the newest adds nothing", (await h.keep(note("due"), "sync")) === false);
ok(
  "newest first",
  (await h.list("n")).map((v) => v.reason).join() === "agent,ai",
  (await h.list("n")).map((v) => v.reason)
);
for (let i = 0; i < 25; i++) {
  now += 11 * MIN;
  await h.keep(note("v" + i), "edit");
}
ok("twenty at most, and no body left behind", (await h.list("n")).length === 20 && be.m.size === 21, be.m.size);
const [p, q] = await Promise.all([h.keep(note("p"), "replace"), h.keep(note("q"), "cleanup")]);
ok(
  "two at the same instant are both stored",
  p &&
    q &&
    (await h.list("n"))
      .slice(0, 2)
      .map((v) => v.reason)
      .sort()
      .join() === "cleanup,replace"
);
const heavy = createHistory(mem(), () => now);
for (let i = 0; i < 20; i++) {
  now += 11 * MIN;
  await heavy.keep(note("x".repeat(700000) + i), "edit");
}
ok("a 700 KB note keeps what fits in 5 MB", (await heavy.list("n")).length === 7, (await heavy.list("n")).length);
const failing = {
  ...mem(),
  write: async () => {
    throw new Error("disk full");
  },
};
const seen = [];
ok(
  "a failed write answers false, throws nothing, and is reported",
  (await createHistory(
    failing,
    () => 0,
    (e) => seen.push(e)
  ).keep(note("x"), "ai")) === false && seen.length === 1
);
const broken = mem();
broken.m.set("i:n", "{not json");
ok(
  "an unreadable index is left as it is",
  (await createHistory(
    broken,
    () => 0,
    () => {}
  ).keep(note("x"), "ai")) === false &&
    broken.m.get("i:n") === "{not json" &&
    broken.m.size === 1
);
const racing = h.keep(note("r"), "restore");
const dropping = h.dropNote("n");
await Promise.all([racing, dropping]);
ok("a note deleted while a version is written leaves nothing", be.m.size === 0, [...be.m.keys()]);
await h.keep({ ...note("a"), id: "gone" }, "ai");
await h.keep({ ...note("a"), id: "here" }, "ai");
be.m.set("v:here:stray", "{}");
await h.sweep(new Set(["here"]));
ok("the sweep", (await h.list("gone")).length === 0 && (await h.list("here")).length === 1 && !be.m.has("v:here:stray"), [
  ...be.m.keys(),
]);
await h.wipe();
ok("wipe", be.m.size === 0);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
