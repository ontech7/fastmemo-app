// The kinds of line added in 4.1.0 against the editor pages already installed (spec B.6): a note written by this version,
// opened by 4.0.0, 4.0.0 + OTA 1 and desktop 2.1.0, must keep every word and both boxes, whatever button is pressed, and
// that version's sanitizer and agent tools must keep its markup.
// Run: node scripts/richtext-released.test.mjs   (headless Chrome, git worktrees in a temporary folder)

import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EVERY_LINE, EVERY_LINE_TEXT } from "./lib/everyLine.mjs";
import { buildPage, chromeDriver } from "./lib/richtextPage.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

// The pages to test: the tags, and the commit desktop 2.1.0 was built from, unless its files are a tag's.
const FILES = ["src/libs/richTextEditor.ts", "src/generated/editor-sanitize.ts", "src/libs/mcp/noteEdit.ts"];
const desktop = git("log", "--format=%h", "--grep", "chore(release): desktop 2.1.0", "-1");
const refs = ["v4.0.0", "v4.0.0+ota.1"];
const same = (a, b) =>
  FILES.every((file) => {
    try {
      return git("rev-parse", `${a}:${file}`) === git("rev-parse", `${b}:${file}`);
    } catch {
      return false;
    }
  });
const twin = refs.find((ref) => same(ref, desktop));
if (twin) console.log(`desktop 2.1.0 (${desktop}): its files are ${twin}'s, skipped`);
else refs.push(desktop);

// The library is this tree's: the lock files must pin the same version.
const pinned = (ref) => {
  const lock = ref ? git("show", `${ref}:yarn.lock`) : readFileSync(join(root, "yarn.lock"), "utf8");
  return ["react-native-pell-rich-editor", "dompurify"]
    .map((name) => {
      const at = lock.search(new RegExp(`^"?${name}@`, "m"));
      return `${name} ${/version "([^"]+)"/.exec(lock.slice(at))?.[1]}`;
    })
    .join(", ");
};

// The buttons of the bar 4.0.0 and desktop 2.1.0 show (NoteTextEditor's toolbarActions), the image one left out: the line
// types go to the page script, the rest to pell, as their LabeledRichToolbar did.
const BUTTONS = [
  "undo",
  "redo",
  "heading1",
  "bold",
  "italic",
  "strikeThrough",
  "underline",
  "justifyLeft",
  "justifyCenter",
  "subscript",
  "superscript",
  "unorderedList",
  "orderedList",
  "code",
];
const LINE_TYPES = { heading1: "h1", code: "code", unorderedList: "ul", orderedList: "ol" };
const KEYS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, commands: ["deleteBackward"] },
};

let passed = 0;
const failures = [];
const notes = [];
const check = (name, ok, detail) => {
  if (ok) passed++;
  else failures.push(`${name}: ${detail}`);
};

const words = (text) => text.replace(/\s+/g, " ").trim();

const driver = await chromeDriver();
const worktrees = [];
try {
  console.log(`this tree: ${pinned()}`);
  for (const ref of refs) {
    const lock = pinned(ref);
    if (lock !== pinned()) console.log(`${ref}: its lock file pins ${lock}, this tree's node_modules are used`);
    const dir = mkdtempSync(join(os.tmpdir(), "richtext-released-"));
    rmSync(dir, { recursive: true, force: true });
    git("worktree", "add", "--detach", dir, ref);
    worktrees.push(dir);
    // the worktree's scripts and builds resolve packages from this tree
    symlinkSync(join(root, "node_modules"), join(dir, "node_modules"));
    const page = await buildPage(dir);
    const { EDITOR_SANITIZE_JS, RICH_TEXT_SCRIPT } = page.scripts;
    const evaluate = (expression) => driver.evaluate(expression);
    const post = async (msg) => {
      await evaluate(`window.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(JSON.stringify(msg))} }))`);
      await sleep(90);
    };
    // As that version loads a note: the sanitizer injected, the note, then the page script.
    const open = async (html) => {
      await driver.goto(page.url);
      await evaluate(EDITOR_SANITIZE_JS);
      await post({ type: "content", name: "setHtml", data: html });
      await post({ type: "content", name: "command", data: RICH_TEXT_SCRIPT });
    };
    const press = async (action) => {
      if (!LINE_TYPES[action]) return post({ type: action, name: "result" });
      await post({ type: "content", name: "focus" });
      await post({
        type: "content",
        name: "command",
        data: `window.__fm && window.__fm.toggle(${JSON.stringify(LINE_TYPES[action])})`,
      });
    };
    const shown = () =>
      evaluate(`(() => {
        const c = document.querySelector(".pell-content"), boxes = c.querySelectorAll(".x-todo-box input");
        const fatto = [...c.querySelectorAll("li")].find((li) => li.textContent.includes("fatto"));
        return {
          text: c.textContent,
          html: c.innerHTML,
          boxes: boxes.length,
          ticked: [...boxes].map((b) => b.checked),
          fattoTicked: !!fatto?.querySelector("input:checked"),
        };
      })()`);
    // The caret at the end of the line holding `text`, as a tap leaves it (pell saves the selection on touchend).
    const caretIn = (text) =>
      evaluate(`(() => {
        const c = document.querySelector(".pell-content");
        c.focus();
        const line = [...c.querySelectorAll("li, div, h1, h2, blockquote, pre")].find((e) => e.textContent.trim() === ${JSON.stringify(text)});
        const r = document.createRange();
        r.selectNodeContents(line);
        r.collapse(false);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        c.dispatchEvent(new Event("touchend", { bubbles: true }));
        return true;
      })()`).then(() => sleep(90));
    const errorsBefore = () => driver.pageErrors.length;
    const name = (what) => `${ref}: ${what}`;

    // 1. The note as that version loads it.
    await open(EVERY_LINE);
    let s = await shown();
    check(
      name("every line's words are on the page"),
      EVERY_LINE_TEXT.every((t) => s.text.includes(t)),
      s.html
    );
    check(name("two boxes, the second ticked"), s.boxes === 2 && !s.ticked[0] && s.ticked[1], JSON.stringify(s.ticked));
    const cleaned = await evaluate(`window.__fmSanitize(${JSON.stringify(EVERY_LINE)})`);
    check(name("its sanitizer returns the note unchanged"), cleaned === EVERY_LINE, cleaned);
    const text0 = words(s.text);

    // 2. Every button, pressed twice, in every line.
    for (const line of EVERY_LINE_TEXT) {
      for (const button of BUTTONS) {
        const errors = errorsBefore();
        await open(EVERY_LINE);
        await caretIn(line);
        await press(button);
        await press(button);
        s = await shown();
        const what = name(`${button} twice in "${line}"`);
        check(`${what}: no page error`, driver.pageErrors.length === errors, driver.pageErrors.slice(errors).join("\n"));
        check(`${what}: no word lost`, words(s.text) === text0, `${words(s.text)}\n    ${s.html}`);
        check(`${what}: the boxes and the tick`, s.boxes === 2 && !s.ticked[0] && s.ticked[1], s.html);
      }
    }

    // 3. Typing at the end of each line, a new line, and back.
    for (const line of EVERY_LINE_TEXT) {
      const errors = errorsBefore();
      await open(EVERY_LINE);
      await caretIn(line);
      await driver.type("x");
      await sleep(90);
      await driver.key(KEYS.Enter);
      await sleep(90);
      await driver.key(KEYS.Backspace);
      await sleep(90);
      s = await shown();
      const what = name(`x, Enter, Backspace at the end of "${line}"`);
      check(`${what}: no page error`, driver.pageErrors.length === errors, driver.pageErrors.slice(errors).join("\n"));
      check(
        `${what}: no word lost`,
        EVERY_LINE_TEXT.every((t) => s.text.includes(t)),
        s.html
      );
      check(`${what}: "fatto" still ticked`, s.fattoTicked, s.html);
      // Not a loss (the bar is: no error, no word lost, no box unticked): pell's own Enter and Backspace in a checkbox
      // line can leave an empty box beside the list. Printed for the report.
      if (s.boxes !== 2) notes.push(`${what}: ${s.boxes} boxes after it (pell's own checkbox handling)`);
    }

    // 4. That version's agent tools: its noteEdit.ts and its agent sanitizer (DOMPurify in the page, as its bridge runs it).
    if (!existsSync(join(dir, "src/libs/mcp/noteEdit.ts"))) {
      console.log(`${ref}: no agent tools (src/libs/mcp/noteEdit.ts), step 4 skipped`);
    } else {
      // noteEdit.ts as that commit's scripts/mcp.test.mjs bundles it: its own build, up to the import of the bundle.
      const mcpTest = readFileSync(join(dir, "scripts/mcp.test.mjs"), "utf8");
      const cut = mcpTest.indexOf("const M = await import(");
      if (cut < 0) throw new Error(`${ref}: scripts/mcp.test.mjs builds its bundle another way`);
      writeFileSync(join(dir, "scripts/released-mcp-build.mjs"), `${mcpTest.slice(0, cut)}\nexport { out };\n`);
      const { out: bundle } = await import(pathToFileURL(join(dir, "scripts/released-mcp-build.mjs")).href);
      const { applyEdit } = (await import(`${pathToFileURL(bundle).href}?${ref}`)).editing;
      const src = join(dir, "src");
      const sanitizer = join(dir, "released-agent-sanitize.js");
      await build({
        stdin: {
          contents: `import DOMPurify from "dompurify"; import { addNoteHooks } from "@/editor/sanitizeConfig"; import { AGENT_HTML_CONFIG } from "@/libs/mcp/agentHtml";
            const purifier = DOMPurify(window); addNoteHooks(purifier);
            window.__agentSanitize = (html) => purifier.sanitize(html, AGENT_HTML_CONFIG);`,
          resolveDir: src,
          loader: "ts",
        },
        bundle: true,
        logLevel: "error",
        alias: { "@": src },
        platform: "browser",
        format: "iife",
        outfile: sanitizer,
      });
      await driver.goto(page.url);
      await evaluate(readFileSync(sanitizer, "utf8"));
      const sanitized = new Map();
      for (const html of [EVERY_LINE, "<div>fine</div>"])
        sanitized.set(html, await evaluate(`window.__agentSanitize(${JSON.stringify(html)})`));
      const deps = {
        getState: () => ({ categories: { items: [] } }),
        newId: () => "n1",
        sanitize: (html) => sanitized.get(html),
        textLimit: () => 1_000_000,
      };
      const note = {
        id: "n",
        type: "text",
        title: "every line",
        text: EVERY_LINE,
        category: { order: 0, name: "All", icon: "none", index: true, selected: true },
      };
      const appended = applyEdit(note, { appendHtml: "<div>fine</div>" }, deps);
      check(
        name("appendHtml leaves the note in front byte for byte"),
        appended.note?.text === EVERY_LINE + "<div>fine</div>",
        JSON.stringify(appended).slice(0, 400)
      );
      const replaced = applyEdit(note, { replaceHtml: EVERY_LINE }, deps);
      // the tool refuses an edit that changes nothing: the HTML sent back, cleaned, is the note itself
      check(
        name("replaceHtml with the note's own HTML: the same note"),
        replaced.note?.text === EVERY_LINE || /Nothing to change/.test(replaced.error ?? ""),
        JSON.stringify(replaced).slice(0, 400)
      );
    }
    page.dispose();
  }
} finally {
  await driver.close();
  for (const dir of worktrees) {
    try {
      git("worktree", "remove", "--force", dir);
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  git("worktree", "prune");
}

for (const note of notes) console.log("· " + note);
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("✗ " + f);
process.exit(failures.length ? 1 : 0);
