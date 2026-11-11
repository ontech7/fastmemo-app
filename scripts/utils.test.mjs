// Small pure helpers of src/utils and src/libs: how a picture is reduced, important notes first, deep search, and the\n// others added below as tasks need them.
// Run: node scripts/utils.test.mjs
// It bundles the modules with esbuild; AsyncStorage is the in-memory stub.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "utils.bundle.mjs");

await build({
  stdin: {
    contents: `
      export * from "@/utils/imageSize";
      export * from "@/utils/sort";
      export * from "@/utils/noteSearch";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: {
    "@": src,
    "@react-native-async-storage/async-storage": join(__dirname, "_async-storage-stub.js"),
  },
});

const M = await import(pathToFileURL(out).href);
const { default: storage } = await import(pathToFileURL(join(__dirname, "_async-storage-stub.js")).href);

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

console.log("\nhow a picture is reduced");
{
  const { resizeFor, PHOTO_LONG_SIDE, PHOTO_QUALITY } = M;
  ok("landscape", JSON.stringify(resizeFor(4000, 3000)) === '{"width":1600}');
  ok("portrait", JSON.stringify(resizeFor(3000, 4000)) === '{"height":1600}');
  ok("already small", resizeFor(1600, 900) === null && resizeFor(800, 600) === null);
  ok("no size known", resizeFor(undefined, 0) === null);
  ok("another long side", JSON.stringify(resizeFor(2000, 1000, 1000)) === '{"width":1000}');
  ok("the values", PHOTO_LONG_SIDE === 1600 && PHOTO_QUALITY === 0.6);
}

console.log("\nimportant notes first, in the chosen order");
{
  const { importantFirst } = M;
  const n = (id, important, extra = {}) => ({ id, important, hidden: false, ...extra });
  const list = [n(1, false), n(2, true), n(3, false), n(4, true)];
  ok(
    "important first, both groups in the order given",
    importantFirst(list, () => true)
      .map((x) => x.id)
      .join() === "2,4,1,3"
  );
  ok(
    "the same with the opposite order",
    importantFirst([...list].reverse(), () => true)
      .map((x) => x.id)
      .join() === "4,2,3,1"
  );
  ok(
    "filtered",
    importantFirst(list, (x) => x.id !== 2)
      .map((x) => x.id)
      .join() === "4,1,3"
  );
}

console.log("\ndeep search");
{
  const { matchesDeepSearch } = M;
  const base = { id: "x", title: "Spesa di Natale", important: false };
  ok("title", matchesDeepSearch({ ...base, type: "text", text: "" }, "natale"));
  ok(
    "text, through its markup",
    matchesDeepSearch({ ...base, type: "text", text: "<div>com<b>pra</b>re il <i>panettone</i></div>" }, "panettone")
  );
  ok(
    "list item",
    matchesDeepSearch({ ...base, type: "todo", list: [{ id: "1", text: "Torrone", checked: false }] }, "torrone")
  );
  ok(
    "column name",
    matchesDeepSearch({ ...base, type: "kanban", columns: [{ id: "c", name: "Da Fare", color: "", items: [] }] }, "da fare")
  );
  ok(
    "card",
    matchesDeepSearch(
      { ...base, type: "kanban", columns: [{ id: "c", name: "", color: "", items: [{ id: "k", text: "Regalo Anna" }] }] },
      "anna"
    )
  );
  ok(
    "tab title and code",
    matchesDeepSearch(
      {
        ...base,
        type: "code",
        tabs: [{ id: "t", title: "Lista.py", code: "print('ciao')", language: "python" }],
        activeTabId: "t",
      },
      "lista.py"
    ) &&
      matchesDeepSearch(
        { ...base, type: "code", tabs: [{ id: "t", title: "", code: "print('ciao')", language: "python" }], activeTabId: "t" },
        "ciao"
      )
  );
  ok("no match", !matchesDeepSearch({ ...base, type: "todo", list: [] }, "pasqua"));
  ok(
    "an unknown type by title only",
    matchesDeepSearch({ ...base, type: "board", strokes: "natale-not-here" }, "spesa") &&
      !matchesDeepSearch({ ...base, type: "board" }, "zzz")
  );
  ok(
    "missing parts don't throw",
    !matchesDeepSearch({ ...base, type: "kanban" }, "zzz") && !matchesDeepSearch({ id: "y", type: "code" }, "zzz")
  );
}

void storage;
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
