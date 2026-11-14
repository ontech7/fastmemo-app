// What a list note does with its items (spec B.7): Enter adds the next one, Backspace removes an empty one, the completed
// ones can be hidden (and moved around the hidden ones) or deleted. src/libs/listOps.ts, pure.
// Run: node scripts/list-ops.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const out = join(os.tmpdir(), "list-ops.bundle.mjs");
await build({
  entryPoints: [join(src, "libs/listOps.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
});
const { insertAfter, freshAfter, removeItem, visibleItems, moveVisibleTo, withoutDone, doneCount } = await import(
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

const L = (spec) =>
  spec.split(" ").map((s) => ({ id: s.replace("*", ""), text: s.replace("*", ""), checked: s.endsWith("*") }));
const show = (list) => list.map((i) => i.id + (i.checked ? "*" : "")).join(" ");
const fresh = { id: "n", text: "", checked: false };

console.log("\n=== A list's items ===");
ok(
  "insert after",
  show(insertAfter(L("a b c"), "a", fresh)) === "a n b c" &&
    show(insertAfter(L("a b"), "b", fresh)) === "a b n" &&
    show(insertAfter(L("a b"), "zz", fresh)) === "a b n"
);
ok(
  "the item just made under another, still empty, is found again (a key that submits twice makes one item)",
  (() => {
    const l = insertAfter(L("a b"), "a", fresh);
    const typed = l.map((i) => (i.id === "n" ? { ...i, text: "x" } : i));
    return (
      freshAfter(l, "a", "n") &&
      !freshAfter(typed, "a", "n") &&
      !freshAfter(l, "b", "n") &&
      !freshAfter(L("a b"), "a", "n") &&
      !freshAfter(l, "a", null)
    );
  })()
);
ok(
  "remove: the focus goes above",
  (() => {
    const r = removeItem(L("a b c"), "b");
    return show(r.list) === "a c" && r.focusId === "a";
  })()
);
ok(
  "remove the first: the focus goes below",
  (() => {
    const r = removeItem(L("a b"), "a");
    return show(r.list) === "b" && r.focusId === "b";
  })()
);
ok(
  "the only item stays",
  (() => {
    const r = removeItem(L("a"), "a");
    return show(r.list) === "a" && r.focusId === null;
  })()
);
ok(
  "remove with the done ones hidden: the focus goes to the nearest visible one",
  (() => {
    const r = removeItem(L("a b* c"), "c", true);
    return show(r.list) === "a b*" && r.focusId === "a";
  })()
);
ok("visible", show(visibleItems(L("a b* c d*"), true)) === "a c" && show(visibleItems(L("a b*"), false)) === "a b*");
ok(
  "move among the visible: hidden ones stay put",
  show(moveVisibleTo(L("a b* c d* e"), "e", 0, true)) === "e b* a d* c" &&
    show(moveVisibleTo(L("a b* c d* e"), "a", 3, true)) === "c b* e d* a"
);
ok("move with everything visible", show(moveVisibleTo(L("a b* c"), "c", 0, false)) === "c a b*");
ok(
  "its own slot, the next one, or an id that isn't visible: unchanged",
  (() => {
    const l = L("a b* c");
    return (
      moveVisibleTo(l, "a", 0, true) === l &&
      moveVisibleTo(l, "a", 1, true) === l &&
      moveVisibleTo(l, "b", 0, true) === l &&
      moveVisibleTo(l, "zz", 0, true) === l
    );
  })()
);
ok("a slot out of range is clamped", show(moveVisibleTo(L("a b* c"), "a", 99, true)) === "c b* a");
ok("without the done ones", show(withoutDone(L("a b* c d*"))) === "a c" && doneCount(L("a b* c d*")) === 2);
ok(
  "the results hold the list's own items",
  (() => {
    const l = L("a b* c");
    return insertAfter(l, "a", fresh)[0] === l[0] && moveVisibleTo(l, "c", 0, false)[1] === l[0];
  })()
);
ok(
  "nothing is changed in place",
  (() => {
    const l = L("a b* c");
    insertAfter(l, "a", fresh);
    removeItem(l, "a");
    moveVisibleTo(l, "c", 0, true);
    withoutDone(l);
    return show(l) === "a b* c";
  })()
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
