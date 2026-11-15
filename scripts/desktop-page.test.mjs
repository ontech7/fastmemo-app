// The desktop's page in a real browser, headless Chrome (scripts/lib/richtextPage.mjs): the list's keyboard mark kept
// clear of what lies over the list's bottom, so Enter opens the marked note (spec C.1); the print style hiding the page
// only while a note is laid out for print (spec C.5). Run: node scripts/desktop-page.test.mjs

import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromeDriver } from "./lib/richtextPage.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const dir = mkdtempSync(join(os.tmpdir(), "desktop-list-"));

const stub = (filter, contents) => ({
  name: `stub-${filter}`,
  setup(b) {
    b.onResolve({ filter }, () => ({ path: String(filter), namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => (args.path === String(filter) ? { contents, loader: "js" } : undefined));
  },
});
const bundle = await build({
  stdin: {
    contents: `import * as L from "@/libs/desktopList"; import { printCss } from "@/libs/printCss"; import { reducePhoto } from "@/libs/reducePhoto"; window.L = L; window.printCss = printCss; window.reducePhoto = reducePhoto;`,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  write: false,
  logLevel: "error",
  alias: { "@": src },
  resolveExtensions: [".web.ts", ".web.tsx", ".ts", ".tsx", ".js"],
  plugins: [
    stub(/^expo-router$/, "export const router = { push() {}, navigate() {}, dismissTo() {} };"),
    stub(/libs\/desktopZoom$/, "export const zoom = () => {};"),
    // only reached by the native reducer; the web one draws on a canvas
    stub(/^expo-image-manipulator$/, "export const ImageManipulator = {}; export const SaveFormat = {};"),
    stub(/^react-native$/, "export const Image = { getSize: (u, ok, no) => { const i = new window.Image(); i.onload = () => ok(i.naturalWidth, i.naturalHeight); i.onerror = no; i.src = u; } };"),
  ],
});

// A list of 30 notes in a 400 px scroll area, with an 80 px bar over its bottom (the selection bar's place).
const rows = Array.from({ length: 30 }, (_, i) => `<div class="card" data-id="n${i}">note ${i}</div>`).join("");
const html = `<!doctype html><html><head><style>
  body { margin: 0; }
  #list { position: relative; height: 400px; overflow-y: auto; }
  .card { height: 60px; box-sizing: border-box; border-bottom: 1px solid #ccc; }
  #bar { position: absolute; left: 0; right: 0; top: 320px; height: 80px; background: #333; }
</style></head><body>
<div id="wrap" style="position: relative"><div id="list">${rows}</div><div id="bar"></div></div>
<script>${bundle.outputFiles[0].text}</script>
<script>
  window.opened = null;
  document.querySelectorAll(".card").forEach((card) => card.addEventListener("click", () => (window.opened = card.dataset.id)));
  const ids = [...document.querySelectorAll(".card")].map((card) => card.dataset.id);
  L.setListHost({ ids, trash() {}, scrollTo() {} });
  // What the cards do when the mark moves: the marked one carries the test id (NoteCard, through useIsCursor).
  window.mark = () => {
    document.querySelectorAll(".card").forEach((card) => card.removeAttribute("data-testid"));
    const id = L.getCursor();
    if (id) document.querySelector('[data-id="' + id + '"]').setAttribute("data-testid", "shortcut-cursor-note");
  };
  window.step = (key) => { const used = L.listKey(key); window.mark(); return used; };
</script></body></html>`;
const file = join(dir, "list.html");
writeFileSync(file, html);

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

const driver = await chromeDriver();
try {
  await driver.goto(pathToFileURL(file).href);
  const evaluate = (expression) => driver.evaluate(expression);
  const frames = () => evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");

  console.log("\nthe mark past the visible rows, with a bar over the list's bottom");
  for (let i = 0; i < 12; i++) {
    await evaluate(`window.step("down")`);
    await frames();
  }
  await sleep(50);
  const clear = await evaluate(`(() => {
    const card = document.querySelector('[data-testid="shortcut-cursor-note"]');
    const bar = document.getElementById("bar").getBoundingClientRect();
    const r = card.getBoundingClientRect();
    return JSON.stringify({ id: card.dataset.id, bottom: r.bottom, barTop: bar.top });
  })()`);
  const seen = JSON.parse(clear);
  ok("the marked note is above the bar", seen.id === "n11" && seen.bottom <= seen.barTop, clear);
  await evaluate(`window.step("enter")`);
  ok("Enter opens it", (await evaluate("window.opened")) === "n11", await evaluate("String(window.opened)"));

  console.log("\nthe mark coming back up stays where it is when whole on screen");
  const before = await evaluate(`document.getElementById("list").scrollTop`);
  await evaluate(`window.step("up")`);
  await frames();
  await sleep(50);
  ok("one up: no scroll", (await evaluate(`document.getElementById("list").scrollTop`)) === before);

  console.log("\nthe mark shown again after the mouse scrolled the list away: it lands under the whole bar");
  await evaluate(`L.leaveKeyboardMode(); document.getElementById("list").scrollTop = 0;`);
  await frames();
  await evaluate(`window.step("down")`); // the first arrow shows it again where it was (n10)
  await frames();
  await sleep(50);
  const again = JSON.parse(
    await evaluate(`(() => {
      const card = document.querySelector('[data-testid="shortcut-cursor-note"]');
      return JSON.stringify({ id: card.dataset.id, bottom: card.getBoundingClientRect().bottom });
    })()`)
  );
  ok("it is lifted above the bar", again.id === "n10" && again.bottom <= 320, JSON.stringify(again));
  await evaluate(`window.opened = null; window.step("enter")`);
  ok("Enter opens it", (await evaluate("window.opened")) === "n10");

  console.log("\nprinting: the page hidden only while a note is laid out for it");
  await evaluate(`(() => { const st = document.createElement("style"); st.textContent = printCss(); document.head.appendChild(st); })()`);
  await driver.send("Emulation.setEmulatedMedia", { media: "print" });
  const shown = () => evaluate(`getComputedStyle(document.getElementById("wrap")).display`);
  ok("no copy (the note left): the browser's own print shows the page", (await shown()) !== "none", await shown());
  await evaluate(`(() => { const c = document.createElement("div"); c.id = "fm-print"; c.textContent = "the note"; document.body.appendChild(c); })()`);
  ok("a note laid out: only it is printed", (await shown()) === "none" && (await evaluate(`getComputedStyle(document.getElementById("fm-print")).display`)) === "block");
  await driver.send("Emulation.setEmulatedMedia", { media: "" });

  console.log("\na pasted picture with transparency (a window's screenshot, a logo)");
  const pixel = JSON.parse(
    await evaluate(`(async () => {
      const c = document.createElement("canvas"); c.width = 40; c.height = 20;
      const g = c.getContext("2d"); g.fillStyle = "#e33"; g.fillRect(0, 0, 20, 20); // the right half left transparent
      const jpeg = await reducePhoto(c.toDataURL("image/png"));
      const img = new Image(); img.src = "data:image/jpeg;base64," + jpeg; await img.decode();
      const d = document.createElement("canvas"); d.width = img.width; d.height = img.height;
      const h = d.getContext("2d"); h.drawImage(img, 0, 0);
      return JSON.stringify({ w: img.width, clear: [...h.getImageData(30, 10, 1, 1).data].slice(0, 3), red: [...h.getImageData(5, 10, 1, 1).data].slice(0, 3) });
    })()`)
  );
  ok("its transparent part comes out white, not black", pixel.clear.every((v) => v > 240), JSON.stringify(pixel));
  ok("its drawn part kept, its size too", pixel.w === 40 && pixel.red[0] > 180 && pixel.red[1] < 90, JSON.stringify(pixel));
  const big = JSON.parse(
    await evaluate(`(async () => {
      const c = document.createElement("canvas"); c.width = 3200; c.height = 1000;
      c.getContext("2d").fillRect(0, 0, 10, 10);
      const jpeg = await reducePhoto(c.toDataURL("image/png"));
      const img = new Image(); img.src = "data:image/jpeg;base64," + jpeg; await img.decode();
      return JSON.stringify({ w: img.width, h: img.height });
    })()`)
  );
  ok("a large one brought to 1600 on its long side", big.w === 1600 && big.h === 500, JSON.stringify(big));
  ok("no page error", driver.pageErrors.length === 0, driver.pageErrors.join(" | "));
} finally {
  await driver.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
