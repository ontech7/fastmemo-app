// Where a dragged kanban card lands: computed from the rectangles measured when it was lifted and the scroll since, and
// handed to moveCard, the card ends where the drop line was (spec 4).
// Run: node scripts/kanban-drop.test.mjs

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "kanban-drop.bundle.mjs");

await build({
  stdin: {
    contents: `export * from "@/libs/kanbanDrop"; export { moveCard } from "@/libs/kanbanOps";`,
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
const { findDrop, isOwnPlace, moveCard, edgeStep, LINE_INSET, BOARD_SLACK } = await import(pathToFileURL(out).href);

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

/*
 * The board at (0, 100), 360 x 600. Columns 300 wide with a 12 px gap, the first at x = 18. Card areas from y = 220,
 * 400 high. Cards stacked from the area's top with an 8 px gap, from the heights given per column.
 */
const COLUMN_WIDTH = 300;
const COLUMN_GAP = 12;
const FIRST_X = 18;
const AREA_Y = 220;
const CARD_GAP = 8;
const layout = (heights) => {
  const columns = Object.entries(heights).map(([id, cardHeights], c) => {
    const x = FIRST_X + c * (COLUMN_WIDTH + COLUMN_GAP);
    let y = AREA_Y;
    const cards = cardHeights.map((height) => {
      const card = { x, y, width: COLUMN_WIDTH, height };
      y += height + CARD_GAP;
      return card;
    });
    return { id, area: { x, y: AREA_Y, width: COLUMN_WIDTH, height: 400 }, cards };
  });
  return {
    board: { x: 0, y: 100, width: 360, height: 600 },
    columns,
    boardScrollX: 0,
    columnScrollY: columns.map(() => 0),
  };
};
/** The board's columns as the note holds them: card ids `<column in lower case><index>`. */
const columnsOf = (l) =>
  l.columns.map((column) => ({
    id: column.id,
    name: column.id,
    color: "#fff",
    items: column.cards.map((_, i) => ({ id: `${column.id.toLowerCase()}${i}`, text: "" })),
  }));
const order = (columns, id) =>
  columns
    .find((column) => column.id === id)
    .items.map((item) => item.id)
    .join(",");

console.log("\nfindDrop");

ok("the constants", LINE_INSET === 8 && BOARD_SLACK === 24, { LINE_INSET, BOARD_SLACK });

const L = layout({ A: [40, 120, 40], B: [], C: [60] }); // A's cards at y 220-260, 268-388, 396-436; B is empty
const still = { boardScrollX: 0, columnScrollY: [0, 0, 0] };
const at = (x, y, scroll = still) => findDrop(L, scroll, x, y);

ok("above the first card", at(100, 225)?.column === 0 && at(100, 225)?.index === 0, at(100, 225));
ok(
  "between cards of different heights: the middle decides",
  at(100, 220 + 40 + 8 + 59)?.index === 1 && at(100, 220 + 40 + 8 + 61)?.index === 2,
  [at(100, 327), at(100, 329)]
);
ok("below the last card", at(100, 560)?.index === 3, at(100, 560));
ok(
  "an empty column: slot 0, line at the top of its card area",
  at(18 + 312 + 10, 400)?.column === 1 && at(18 + 312 + 10, 400)?.index === 0 && at(18 + 312 + 10, 400)?.line.y === 226,
  at(340, 400)
);
ok("the line sits in the gap", at(100, 220 + 40 + 8 + 61)?.line.y === 220 + 40 + 8 + 120 + 4, at(100, 329));
// 4 above the first card is 216, above the card area: clamped to its top.
ok("the line above the first card", at(100, 225)?.line.y === 220, at(100, 225));
ok("the line below the last card", at(100, 560)?.line.y === 436 + 4, at(100, 560));
ok(
  "the line spans the card area minus the inset",
  at(100, 225)?.line.x === 18 + 8 && at(100, 225)?.line.width === 300 - 16,
  at(100, 225)
);
ok(
  "a column scrolled by 100 since the lift",
  at(100, 235, { boardScrollX: 0, columnScrollY: [100, 0, 0] })?.index === 2,
  at(100, 235, { boardScrollX: 0, columnScrollY: [100, 0, 0] })
);
ok(
  "a board scrolled by 312 since the lift: the same point is the next column",
  at(100, 400, { boardScrollX: 312, columnScrollY: [0, 0, 0] })?.column === 1,
  at(100, 400, { boardScrollX: 312, columnScrollY: [0, 0, 0] })
);
ok(
  "a board scrolled: the line follows the column",
  at(100, 400, { boardScrollX: 312, columnScrollY: [0, 0, 0] })?.line.x === 18 + 8,
  at(100, 400, { boardScrollX: 312, columnScrollY: [0, 0, 0] })
);
ok("in the gap: the nearer column", at(18 + 300 + 2, 300)?.column === 0 && at(18 + 300 + 10, 300)?.column === 1, [
  at(320, 300),
  at(328, 300),
]);
const atLast = { boardScrollX: 624, columnScrollY: [0, 0, 0] }; // scrolled to the third column
ok("left of the first column, right of the last: nowhere", at(5, 300) === null && at(330, 300, atLast) === null, [
  at(5, 300),
  at(330, 300, atLast),
]);
ok("far above or below the board: nowhere", at(100, 60) === null && at(100, 100 + 600 + 30) === null, [
  at(100, 60),
  at(100, 730),
]);
ok("just outside the board still counts", at(100, 100 + 600 + 10) !== null);
ok("far beside the board: nowhere", at(360 + 30, 300) === null && at(-30, 300) === null);
ok(
  "a line never leaves the card area",
  at(100, 225, { boardScrollX: 0, columnScrollY: [300, 0, 0] })?.line.y >= 220 &&
    at(100, 225, { boardScrollX: 0, columnScrollY: [-300, 0, 0] })?.line.y <= 620,
  [
    at(100, 225, { boardScrollX: 0, columnScrollY: [300, 0, 0] }),
    at(100, 225, { boardScrollX: 0, columnScrollY: [-300, 0, 0] }),
  ]
);
ok("the first and the last column", at(20, 300)?.column === 0 && at(100, 300, atLast)?.column === 2);

console.log("\nwith moveCard: the card ends where the line was");

const cols = columnsOf(L); // A: a0 a1 a2, B: -, C: c0
ok("down in its own column", order(moveCard(cols, "a0", "A", "A", at(100, 560).index), "A") === "a1,a2,a0");
ok("up in its own column", order(moveCard(cols, "a2", "A", "A", at(100, 225).index), "A") === "a2,a0,a1");
ok("into the middle of its own column", order(moveCard(cols, "a0", "A", "A", at(100, 329).index), "A") === "a1,a0,a2");
{
  const target = at(340, 400);
  const moved = moveCard(cols, "a1", "A", L.columns[target.column].id, target.index);
  ok("into an empty column", order(moved, "A") === "a0,a2" && order(moved, "B") === "a1", [
    order(moved, "A"),
    order(moved, "B"),
  ]);
}
{
  const target = at(100, 225, atLast);
  const moved = moveCard(cols, "a0", "A", L.columns[target.column].id, target.index);
  ok("above the first card of another column", order(moved, "C") === "a0,c0", order(moved, "C"));
}
ok(
  "its own place",
  isOwnPlace(at(100, 225), 0, 0) && isOwnPlace(at(100, 220 + 40 + 2), 0, 0) && !isOwnPlace(at(100, 560), 0, 0)
);
ok("another column is never its own place", !isOwnPlace(at(340, 400), 0, 0));

// The edge scroll (KanbanBoard, KanbanColumn): a speed per second, so a 120 Hz screen scrolls as far as a 60 Hz one.
{
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const second = (hz) => {
    let total = 0;
    for (let i = 0; i < hz; i++) total += edgeStep(0, 48, 840, 1000 / hz);
    return total;
  };
  ok("edge scroll: a second at the edge moves its speed per second at 60 Hz", near(second(60), 840), second(60));
  ok("edge scroll: the same distance at 120 Hz", near(second(120), 840), second(120));
  ok(
    "edge scroll: nothing at the edge zone's border or beyond",
    edgeStep(48, 48, 840, 16) === 0 && edgeStep(90, 48, 840, 16) === 0
  );
  ok("edge scroll: half speed halfway into the zone", near(edgeStep(24, 48, 1000, 10), 5), edgeStep(24, 48, 1000, 10));
  ok("edge scroll: past the edge counts as at it", near(edgeStep(-10, 48, 1000, 10), 10), edgeStep(-10, 48, 1000, 10));
  ok(
    "edge scroll: a stalled frame moves at most 50 ms worth",
    near(edgeStep(0, 48, 1000, 400), 50),
    edgeStep(0, 48, 1000, 400)
  );
  ok(
    "edge scroll: the first frame (no length) counts as one 60 Hz frame",
    near(edgeStep(0, 48, 600, null), 10) && near(edgeStep(0, 48, 600, undefined), 10),
    edgeStep(0, 48, 600, null)
  );
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
