// Kanban board operations: a move never loses or doubles a card, whatever happened to the board (a column
// deleted, a card gone, a stale index) (LL-078).
// Run: node scripts/kanban.test.mjs

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "kanban.bundle.mjs");

await build({
  stdin: { contents: `export * from "@/libs/kanbanOps";`, resolveDir: src, loader: "ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
});
const { moveCard } = await import(pathToFileURL(out).href);

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

const col = (id, ...ids) => ({ id, name: id, color: "#fff", items: ids.map((i) => ({ id: i, text: i })) });
const board = () => [col("A", "a1", "a2", "a3"), col("B", "b1"), col("C")];
const ids = (columns, id) =>
  columns
    .find((c) => c.id === id)
    .items.map((i) => i.id)
    .join();

console.log("\nmoveCard");
ok("to another column, at the slot", ids(moveCard(board(), "a2", "A", "B", 0), "B") === "a2,b1");
ok("to another column, at the end", ids(moveCard(board(), "a2", "A", "B", 1), "B") === "b1,a2");
ok("and it leaves its column", ids(moveCard(board(), "a2", "A", "B", 0), "A") === "a1,a3");
ok("into an empty column", ids(moveCard(board(), "a2", "A", "C", 5), "C") === "a2");
ok("down in its own column", ids(moveCard(board(), "a1", "A", "A", 3), "A") === "a2,a3,a1");
ok("one down in its own column", ids(moveCard(board(), "a1", "A", "A", 2), "A") === "a2,a1,a3");
ok("up in its own column", ids(moveCard(board(), "a3", "A", "A", 0), "A") === "a3,a1,a2");
ok("a negative slot is the first", ids(moveCard(board(), "a3", "A", "B", -2), "B") === "a3,b1");
const same = board();
ok("its own place changes nothing", moveCard(same, "a2", "A", "A", 1) === same && moveCard(same, "a2", "A", "A", 2) === same);
ok("a deleted target changes nothing", moveCard(same, "a2", "A", "gone", 0) === same);
ok(
  "a card that isn't there changes nothing",
  moveCard(same, "zz", "A", "B", 0) === same && moveCard(same, "a2", "B", "C", 0) === same
);
ok("a deleted source column changes nothing", moveCard(same, "a2", "gone", "B", 0) === same);
ok("the board it got is never changed", JSON.stringify(same) === JSON.stringify(board()));
ok("a card keeps its fields", moveCard(board(), "a2", "A", "B", 0)[1].items[0].text === "a2");

console.log("\n5000 random moves");
{
  // mulberry32: a small seeded generator, so a failure repeats
  let seed = 20261111;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const all = (columns) =>
    columns
      .flatMap((c) => c.items.map((i) => i.id))
      .sort()
      .join();
  const initial = all(board());
  let columns = board();
  let broken = null;
  for (let n = 0; n < 5000 && !broken; n++) {
    const card = pick(["a1", "a2", "a3", "b1", "zz"]);
    const from = pick(["A", "B", "C", "gone"]);
    const to = pick(["A", "B", "C", "gone"]);
    const index = Math.floor(rand() * 9) - 2;
    columns = moveCard(columns, card, from, to, index);
    if (all(columns) !== initial) broken = { n, card, from, to, index, columns };
  }
  ok("the cards on the board are always the same four", broken === null, broken);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
