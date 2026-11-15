// Small pure helpers of src/utils and src/libs: how a picture is reduced, important notes first, deep search, the quick
// note bar's draft, and the others added below as tasks need them.
// Run: node scripts/utils.test.mjs
// It bundles the modules with esbuild; AsyncStorage is the in-memory stub.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

import { EVERY_LINE, EVERY_LINE_TEXT } from "./lib/everyLine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "utils.bundle.mjs");

await build({
  stdin: {
    contents: `
      export * from "@/utils/imageSize";
      export * from "@/utils/sort";
      export * from "@/libs/quickNoteDraft";
      export * from "@/utils/noteEmpty";
      export * from "@/utils/noteType";
      export * from "@/libs/links";
      export { htmlToMarkdown, wrapHtmlForPdf } from "@/utils/html";
      export { formatToPlainText } from "@/utils/string";
      export { daysAgo } from "@/utils/dateParse";
      export { stepCursor, rangeBetween, menuTargets } from "@/libs/listCursor";
      export { installDropGuard } from "@/libs/dropGuard.web";
      export { ZOOM_STEPS, nextZoom, zoomKeyOf } from "@/libs/zoomSteps";
      export { printCss } from "@/libs/printCss";
      export { createTextFindTarget, createCodeFindTarget, FIND_PAGE } from "@/libs/findTarget";
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
  // html.ts takes stripHtml from the AI's barrel: only its helpers, the store they read stubbed.
  plugins: [
    {
      name: "ai-helpers",
      setup(b) {
        b.onResolve({ filter: /^@\/libs\/ai$/ }, () => ({ path: join(src, "libs/ai/helpers.ts") }));
        b.onResolve({ filter: /^@\/slicers\/store$/ }, () => ({ path: "store", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const store = {};", loader: "js" }));
      },
    },
  ],
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

console.log("\nthe quick note bar's draft");
{
  const { loadQuickNoteDraft, saveQuickNoteDraft, QUICK_NOTE_DRAFT_KEY } = M;
  storage.__reset();
  ok("the key", QUICK_NOTE_DRAFT_KEY === "@quickNoteDraft");
  ok("nothing saved: empty", (await loadQuickNoteDraft()) === "");
  await saveQuickNoteDraft("comprare il latte");
  ok("saved and read back", (await loadQuickNoteDraft()) === "comprare il latte");
  await saveQuickNoteDraft("   ");
  ok("a blank text removes it", storage.get("@quickNoteDraft") === undefined && (await loadQuickNoteDraft()) === "");
  await saveQuickNoteDraft("riga uno\n  riga due  ");
  ok("kept as typed, spaces and lines included", (await loadQuickNoteDraft()) === "riga uno\n  riga due  ");
  storage.__failReads(true);
  ok("a failed read is an empty draft, not an error", (await loadQuickNoteDraft()) === "");
  storage.__reset();
}
{
  // Wiping the data clears the draft too, and the bar showing it (review).
  const { saveQuickNoteDraft, clearQuickNoteDraft, onQuickNoteDraftCleared } = M;
  storage.__reset();
  await saveQuickNoteDraft("una bozza da cancellare");
  let heard = 0;
  const off = onQuickNoteDraftCleared?.(() => heard++);
  await clearQuickNoteDraft?.();
  ok("cleared: gone from the device, and the bar is told", storage.get("@quickNoteDraft") === undefined && heard === 1);
  off?.();
  await clearQuickNoteDraft?.();
  ok("...a bar that went away isn't", heard === 1);
}

console.log("\na note left empty (not kept when its editor closes)");
{
  const { isTodoNoteEmpty, isKanbanNoteEmpty } = M;
  const item = (text) => ({ id: text || "x", text, checked: false });
  const todo = (title, texts) => ({ title, list: texts.map(item) });
  ok("list: no title, no rows", isTodoNoteEmpty(todo("", [])));
  ok("list: no title, one empty row", isTodoNoteEmpty(todo("", [""])));
  ok("list: no title, three empty rows", isTodoNoteEmpty(todo("", ["", "", ""])));
  ok("list: no title, three rows typed", !isTodoNoteEmpty(todo("", ["uno", "due", "tre"])));
  ok("list: no title, one row typed among empty ones", !isTodoNoteEmpty(todo("", ["", "due", ""])));
  ok("list: a title, no rows typed", !isTodoNoteEmpty(todo("Spesa", ["", ""])));
  ok("list: a missing list", isTodoNoteEmpty({ title: "" }));
  const board = (title, columns) => ({
    title,
    columns: columns.map((texts, i) => ({ id: `c${i}`, items: texts.map((text) => ({ id: text || "x", text })) })),
  });
  ok("board: no title, no columns", isKanbanNoteEmpty(board("", [])));
  ok("board: no title, three empty cards", isKanbanNoteEmpty(board("", [["", ""], [""]])));
  ok("board: no title, one card typed", !isKanbanNoteEmpty(board("", [["", "uno"], []])));
  ok("board: a title, empty cards", !isKanbanNoteEmpty(board("Lavori", [[""]])));
  const { isTextNoteEmpty } = M;
  const text = (title, html) => ({ title, text: html });
  ok("text: nothing at all", isTextNoteEmpty(text("", "")));
  ok(
    "text: what the editor leaves when everything is deleted",
    [
      "<div><br></div>",
      "<br>",
      "<p></p>",
      "<div>&nbsp; </div><div><br></div>",
      "<h1><br></h1>",
      "<ul><li><br></li></ul>",
    ].every((html) => isTextNoteEmpty(text("", html)))
  );
  ok("text: a word", !isTextNoteEmpty(text("", "<div>ciao</div>")));
  ok(
    "text: a picture, a rule, a checkbox or a link to a note is something",
    [
      '<div><img src="data:x"></div>',
      "<hr>",
      '<ol class="x-todo"><li><span class="x-todo-box"><input type="checkbox"></span></li></ol>',
      '<a href="#fm-note-a" contenteditable="false">A</a>',
    ].every((html) => !isTextNoteEmpty(text("", html)))
  );
  ok("text: a title alone", !isTextNoteEmpty(text("Idea", "<div><br></div>")));
}

console.log("\nisKnownNoteType");
{
  const { isKnownNoteType } = M;
  ok("the four types and a missing one are known", ["text", "todo", "kanban", "code", undefined, ""].every(isKnownNoteType));
  ok("anything else is not", !isKnownNoteType("board") && !isKnownNoteType(null) && !isKnownNoteType(7));
}

console.log("\nlinks a text note may hold");
{
  const { normalizeLink, noteLinkHref, noteLinkId } = M;
  ok(
    "no scheme gets https",
    normalizeLink("  example.com/a ") === "https://example.com/a" &&
      normalizeLink("localhost:3000/x") === "https://localhost:3000/x"
  );
  ok(
    "the four schemes, any case",
    ["https://a.it", "HTTP://a.it", "mailto:a@b.it", "tel:+39021234"].every((l) => normalizeLink(l) === l)
  );
  ok("a bare email address", normalizeLink("anna@example.com") === "mailto:anna@example.com");
  ok(
    "everything else is refused",
    [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "ftp://a.it",
      "fastmemoapp://notes/1",
      "FastMemoApp://x",
      "data:text/html,x",
      "intent://x",
      "",
      "   ",
      "due parole",
    ].every((l) => normalizeLink(l) === null)
  );
  ok(
    "a user and password in the address are refused",
    normalizeLink("user:password@host") === null && normalizeLink("https://user:pw@a.it/") === null
  );
  ok(
    "note links",
    noteLinkHref("abc-1") === "#fm-note-abc-1" &&
      noteLinkId("#fm-note-abc-1") === "abc-1" &&
      noteLinkId("https://a.it/#fm-note-x") === null &&
      noteLinkId("#other") === null &&
      noteLinkId("#fm-note-") === null
  );
  ok(
    "a note id is 1 to 80 of A-Z a-z 0-9 ~ _ -",
    noteLinkId("#fm-note-" + "a".repeat(80)) === "a".repeat(80) &&
      noteLinkId("#fm-note-" + "a".repeat(81)) === null &&
      noteLinkId("#fm-note-a/b") === null
  );
}

void storage;

console.log("\nexports of a text note with every kind of line");
{
  const { htmlToMarkdown, formatToPlainText, wrapHtmlForPdf } = M;
  const md = htmlToMarkdown(EVERY_LINE);
  ok(
    "markdown: heading 2, quote, rule",
    md.includes("## Titolo due") && md.includes("> Una citazione") && /\n---\n/.test(md),
    md
  );
  ok("markdown: checkboxes", md.includes("- [ ] da fare\n- [x] fatto") && !md.includes("1. da fare"), md);
  ok(
    "markdown: a link, and a note link by its label",
    md.includes("[link](https://example.com/a?b=1)") && md.includes("una nota Altra nota") && !md.includes("fm-note"),
    md
  );
  const plain = formatToPlainText(EVERY_LINE);
  ok(
    "plain text has every line's words, in order",
    EVERY_LINE_TEXT.slice(0, -1).reduce((at, line) => (at < 0 ? at : plain.indexOf(line, at)), 0) >= 0,
    plain
  );
  ok(
    "plain text: a note link is its label, a box is nothing",
    plain.includes("Altra nota") && !plain.includes("fm-note") && !plain.includes("checkbox"),
    plain
  );
  const inline = htmlToMarkdown("<div>a <u>sotto</u> <mark>evid</mark> <code>c</code> <b>b</b>\u200b</div>");
  ok(
    "markdown: underline as __x__, highlight as ==x==, inline code, no zero-width space",
    inline.includes("__sotto__") &&
      inline.includes("==evid==") &&
      inline.includes("`c`") &&
      !inline.includes("\u200b") &&
      !inline.includes("<u>"),
    inline
  );
  const pdfPage = wrapHtmlForPdf("T", "<div>x</div>");
  ok(
    "the PDF page styles the new lines",
    ["blockquote", ".x-todo", "hr", "h2"].every((sel) => pdfPage.includes(sel))
  );
}

console.log("\ndaysAgo: calendar days, not 24-hour spans (the history's Today / Yesterday)");
{
  const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
  ok("the same day", M.daysAgo(at(2026, 11, 14, 0, 1), at(2026, 11, 14, 23, 59)) === 0);
  ok("one minute before midnight is yesterday", M.daysAgo(at(2026, 11, 13, 23, 59), at(2026, 11, 14, 0, 0)) === 1);
  ok("two days", M.daysAgo(at(2026, 11, 12, 18), at(2026, 11, 14, 9)) === 2);
  ok("across a month", M.daysAgo(at(2026, 10, 31, 22), at(2026, 11, 1, 1)) === 1);
  ok("across the clock change (29 March)", M.daysAgo(at(2026, 3, 28, 12), at(2026, 3, 30, 12)) === 2);
}

console.log("\nlistCursor: the desktop list's keyboard mark (Task 25)");
{
  const { stepCursor, rangeBetween } = M;
  const ids = ["a", "b", "c"];
  ok(
    "down from nothing marks the first, up does nothing",
    stepCursor(ids, null, "down") === "a" && stepCursor(ids, null, "up") === null
  );
  ok("down and up", stepCursor(ids, "a", "down") === "b" && stepCursor(ids, "c", "up") === "b");
  ok("down on the last stays", stepCursor(ids, "c", "down") === "c");
  ok("up on the first goes to the field", stepCursor(ids, "a", "up") === "field");
  ok(
    "a mark on a note that is gone starts again from the top",
    stepCursor(ids, "zz", "down") === "a" && stepCursor(ids, "zz", "up") === "field"
  );
  ok("an empty list", stepCursor([], null, "down") === null && stepCursor([], "a", "up") === "field");
  ok(
    "a range, in the list's order either way",
    rangeBetween(ids, "a", "c").join() === "a,b,c" &&
      rangeBetween(ids, "c", "a").join() === "a,b,c" &&
      rangeBetween(ids, "b", "b").join() === "b"
  );
  ok("no anchor: the one clicked", rangeBetween(ids, null, "b").join() === "b" && rangeBetween(ids, "zz", "b").join() === "b");
  ok("an id that isn't listed: nothing", rangeBetween(ids, "a", "zz").length === 0);

  const { menuTargets } = M;
  ok(
    "a right click on a selected note acts on the selection, one note selected too (its key then changes)",
    menuTargets(["a|false"], "a|false").onSelection === true &&
      menuTargets(["a|false", "b|true"], "b|true").ids.join() === "a|false,b|true"
  );
  ok(
    "a right click on a note outside the selection, or with none: that note alone",
    menuTargets(["a|false"], "b|false").onSelection === false &&
      menuTargets(["a|false"], "b|false").ids.join() === "b|false" &&
      menuTargets([], "b|false").ids.join() === "b|false"
  );
}

console.log("\nfiles dropped on the app's window");
{
  const { installDropGuard } = M;
  const target = new EventTarget();
  installDropGuard(target);
  const fire = (type, types) => {
    const e = new Event(type, { cancelable: true });
    const dataTransfer = { types, dropEffect: "copy" };
    Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
    target.dispatchEvent(e);
    return { cancelled: e.defaultPrevented, dropEffect: dataTransfer.dropEffect };
  };
  ok("a file dropped never opens in the window", fire("drop", ["Files"]).cancelled);
  const over = fire("dragover", ["Files"]);
  ok("a file dragged over shows it can't be dropped there", over.cancelled && over.dropEffect === "none", over);
  ok("text dragged is left alone", !fire("drop", ["text/plain"]).cancelled && !fire("dragover", ["text/plain"]).cancelled);
}

console.log("\nthe desktop's zoom steps");
{
  const { nextZoom } = M;
  ok("up and down the steps", nextZoom(100, "in") === 110 && nextZoom(110, "in") === 125 && nextZoom(100, "out") === 90);
  ok("the ends hold", nextZoom(200, "in") === 200 && nextZoom(80, "out") === 80);
  ok("a value between steps goes to the next one that way", nextZoom(120, "in") === 125 && nextZoom(120, "out") === 110);
  ok("nonsense starts from 100", nextZoom(NaN, "in") === 110 && nextZoom(-5, "out") === 90);
  const { zoomKeyOf } = M;
  const k = (key, code, shiftKey = false, altKey = false) => ({ key, code, shiftKey, altKey });
  ok(
    "+ (Italian key, US Shift+=), = and the numpad's plus zoom in",
    zoomKeyOf(k("+", "BracketRight"), true) === "in" &&
      zoomKeyOf(k("+", "Equal", true), true) === "in" &&
      zoomKeyOf(k("=", "Equal"), true) === "in" &&
      zoomKeyOf(k("+", "NumpadAdd"), true) === "in"
  );
  ok(
    "- and the numpad's minus zoom out",
    zoomKeyOf(k("-", "Slash"), true) === "out" && zoomKeyOf(k("-", "NumpadSubtract"), true) === "out"
  );
  ok("0 goes back to 100", zoomKeyOf(k("0", "Digit0"), true) === "reset");
  ok("Shift+0 (= on an Italian Mac, reported as 0) isn't a reset", zoomKeyOf(k("0", "Digit0", true), true) === null);
  ok(
    "without Cmd/Ctrl, or with Alt, nothing",
    zoomKeyOf(k("+", "BracketRight"), false) === null && zoomKeyOf(k("-", "Slash", false, true), true) === null
  );
}

console.log("\nthe printed copy's style sheet");
{
  const css = M.printCss();
  ok("only in print, and only the copy", css.includes("@media print") && css.includes("#fm-print"));
  ok("the page's margins", /@page\s*\{[^}]*margin:\s*18mm 16mm/.test(css), css.match(/@page[^}]*}/)?.[0]);
  ok(
    "pictures and code blocks don't break across pages",
    css.includes("break-inside: avoid") && css.includes("break-after: avoid")
  );
  ok("the checkbox list's and the quote's rules", css.includes(".x-todo-box input") && css.includes("blockquote"));
  ok("printed colours, never the app's dark background", css.includes("#111") && !/#05091A|#131A3C|#1A2248/i.test(css));
  ok("a link shows no address after it", !/attr\(href\)/.test(css));
}

console.log("\nEsc closes a note's find bar");
{
  const { createTextFindTarget, createCodeFindTarget, FIND_PAGE } = M;
  const runs = [];
  let focused = 0;
  const text = createTextFindTarget(
    (s) => runs.push(s),
    () => "uno due tre",
    () => focused++
  );
  text.clear();
  ok("a clear before any search leaves the note's caret alone", runs.length === 0);
  text.search("due");
  runs.length = 0;
  text.clear({ backToNote: true });
  ok(
    "back to the note: the marks go, the note takes the focus, the page puts the caret back",
    runs.length === 2 && runs[0].includes("removeAllRanges") && focused === 1 && runs[1].includes(`${FIND_PAGE}.back()`),
    `${JSON.stringify(runs)} ${focused}`
  );
  text.clear();
  ok("the bar's own clear after it changes nothing", runs.length === 2 && focused === 1);
  text.clear({ backToNote: true });
  ok(
    "back to the note with nothing searched: only the caret",
    runs.length === 3 && runs[2].includes(`${FIND_PAGE}.back()`) && focused === 2
  );
  text.setOpen(true);
  ok("open: the page is told", runs.at(-1).includes(`${FIND_PAGE}.open(true)`), runs.at(-1));
  text.setOpen(false);
  ok("closed: the page is told", runs.at(-1).includes(`${FIND_PAGE}.open(false)`), runs.at(-1));
  let escapes = 0;
  const off = text.onEscape(() => escapes++);
  text.escaped();
  off();
  text.escaped();
  ok("the page's Esc reaches the bar while it listens", escapes === 1);

  const posts = [];
  const code = createCodeFindTarget((r) => posts.push(r));
  code.clear();
  ok("code: a clear before any search sends nothing", posts.length === 0);
  code.search("x");
  code.clear({ backToNote: true });
  ok(
    "code: back to the note asks the page to restore the caret",
    JSON.stringify(posts.at(-1)) === '{"type":"findClear","restore":true}'
  );
  code.clear();
  ok("code: the bar's clear after it sends nothing", posts.length === 2);
  code.setOpen(true);
  ok("code: open is sent", JSON.stringify(posts.at(-1)) === '{"type":"findOpen","open":true}');
  let codeEscapes = 0;
  code.onEscape(() => codeEscapes++);
  code.handle({ type: "findEscape" });
  ok("code: the page's Esc reaches the bar", codeEscapes === 1);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
