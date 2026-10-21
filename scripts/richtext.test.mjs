// Text editor test: the real pell page (createHTML with the app's options and CSS, the note sanitizer, RICH_TEXT_SCRIPT) in headless
// Chrome, driven the way the app drives it: toolbar presses are the same messages RichEditor posts, keys are real key events.
// Run: node scripts/richtext.test.mjs   (needs Google Chrome; CHROME=/path/to/chrome to use another one)

import { build } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const CHROME =
  process.env.CHROME ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
    existsSync
  );
if (!CHROME) {
  console.log("Google Chrome not found: set CHROME=/path/to/chrome");
  process.exit(1);
}

// --- The page --------------------------------------------------------------------------------------------------------

const tmp = mkdtempSync(join(os.tmpdir(), "richtext-"));
const entry = join(tmp, "entry.mjs");
writeFileSync(
  entry,
  `export { RICH_TEXT_SCRIPT, RICH_TEXT_STYLE } from ${JSON.stringify(join(root, "src/libs/richTextEditor.ts"))};
   export { EDITOR_SANITIZE_JS } from ${JSON.stringify(join(root, "src/generated/editor-sanitize.ts"))};
   export { createHTML } from ${JSON.stringify(join(root, "node_modules/react-native-pell-rich-editor/src/editor.js"))};`
);
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(tmp, "page.bundle.mjs"),
  alias: { "@": join(root, "src") },
  logLevel: "error",
  // the style constants import Platform
  plugins: [
    {
      name: "react-native-stub",
      setup(b) {
        b.onResolve({ filter: /^react-native$/ }, () => ({ path: "react-native", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export const Platform = { OS: 'web', select: (o) => o.web ?? o.default };",
          loader: "js",
        }));
      },
    },
  ],
  // editor.js reads window.__DEV__ while building the page
  banner: { js: "globalThis.window ??= {};" },
});
const { EDITOR_SANITIZE_JS, RICH_TEXT_SCRIPT, RICH_TEXT_STYLE, createHTML } = await import(
  pathToFileURL(join(tmp, "page.bundle.mjs"))
);
const page = join(tmp, "page.html");
// RichEditor's props in NoteTextEditor
writeFileSync(page, createHTML({ ...RICH_TEXT_STYLE, useContainer: false, pasteAsPlainText: true }));
const url = pathToFileURL(page).href;

// --- Chrome over the DevTools protocol -------------------------------------------------------------------------------

const profile = join(tmp, "profile");
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" }
);
let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  if (existsSync(join(profile, "DevToolsActivePort")))
    port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
}
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const waiters = [];
const pageErrors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description);
  else waiters.filter((w) => w.method === m.method).forEach((w) => (waiters.splice(waiters.indexOf(w), 1), w.resolve()));
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};
await send("Page.enable");
await send("Runtime.enable");

// What RichEditor.sendAction does: a JSON message to the page. 90 ms covers pell's 50 ms state timer.
const post = async (msg) => {
  await evaluate(`window.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(JSON.stringify(msg))} }))`);
  await sleep(90);
};
const open = async (html) => {
  const loaded = new Promise((resolve) => waiters.push({ method: "Page.loadEventFired", resolve }));
  await send("Page.navigate", { url });
  await loaded;
  // NoteTextEditor's injectedJavaScript: the sanitizer is in the page before the note (LL-060)
  await evaluate(EDITOR_SANITIZE_JS);
  await post({ type: "content", name: "setHtml", data: html });
  await post({ type: "content", name: "command", data: RICH_TEXT_SCRIPT });
};
// The toolbar: the line types go to the page script (after focusContentEditor), the rest to pell, as NoteTextEditor does.
const LINE_TYPES = { heading1: "h1", code: "code", unorderedList: "ul", orderedList: "ol" };
const press = async (action) => {
  if (!LINE_TYPES[action]) return post({ type: action, name: "result" });
  await post({ type: "content", name: "focus" });
  await post({ type: "content", name: "command", data: `window.__fm.toggle(${JSON.stringify(LINE_TYPES[action])})` });
};
const insertImage = async (src) => {
  await post({ type: "content", name: "focus" });
  await post({ type: "content", name: "command", data: `window.__fm.insertImage(${JSON.stringify(src)})` });
};
// { caret: text, at } | { text, from, to } | { from: [text, offset], to: [text, offset] } | { after: selector } | "all"; then a
// touchend, so pell saves the selection like after a tap.
const select = (spec) =>
  evaluate(`(() => {
    const c = document.querySelector(".pell-content"), spec = ${JSON.stringify(spec)};
    c.focus();
    const find = (t) => { const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.data.includes(t)) return n; throw new Error("no text " + t); };
    const r = document.createRange();
    if (spec === "all") r.selectNodeContents(c);
    else if (spec.after) { r.setStartAfter(c.querySelector(spec.after)); r.collapse(true); }
    else if (spec.caret !== undefined) { const n = find(spec.caret); r.setStart(n, n.data.indexOf(spec.caret) + (spec.at ?? 0)); r.collapse(true); }
    else if (spec.text !== undefined) { const n = find(spec.text), b = n.data.indexOf(spec.text); r.setStart(n, b + (spec.from ?? 0)); r.setEnd(n, b + (spec.to ?? spec.text.length)); }
    else { const a = find(spec.from[0]), z = find(spec.to[0]); r.setStart(a, a.data.indexOf(spec.from[0]) + spec.from[1]); r.setEnd(z, z.data.indexOf(spec.to[0]) + spec.to[1]); }
    getSelection().removeAllRanges(); getSelection().addRange(r);
    c.dispatchEvent(new Event("touchend", { bubbles: true }));
  })()`).then(() => sleep(90));
const KEYS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, commands: ["deleteBackward"] },
};
const key = async (name) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...KEYS[name] });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: KEYS[name].key, code: KEYS[name].code });
  await sleep(90);
};
const type = async (text) => {
  await send("Input.insertText", { text });
  await sleep(90);
};
// The content, the type of each line by its text (a code block's lines can be "\n" in one text node), the code blocks
// and the first one's lines as shown, the caret, and the biggest font on screen.
const state = () =>
  evaluate(`(() => {
    const c = document.querySelector(".pell-content"), s = getSelection();
    const lines = {};
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const e = n.parentNode, li = e.closest("li");
      const type = e.closest("pre") ? "code" : e.closest("h1") ? "h1" : li ? li.parentNode.nodeName.toLowerCase() : "p";
      for (const line of n.data.split("\\n")) if (line.trim()) lines[line.trim()] = type;
    }
    const f = s.focusNode;
    return {
      html: c.innerHTML,
      text: c.textContent,
      lines,
      pres: c.querySelectorAll("pre").length,
      // a single line break at the end of a block shows no line
      pre: c.querySelector("pre") && c.querySelector("pre").innerText,
      caret: f ? (f.nodeType === 3 ? f.data : f.nodeName) + "@" + s.focusOffset : null,
      maxFont: Math.max(...[...c.querySelectorAll("*")].map((e) => parseFloat(getComputedStyle(e).fontSize)), 16),
      nested: ["h1 h1", "pre pre", "h1 pre", "pre h1", "h1 ul", "h1 ol", "pre ul", "pre ol", "li h1", "li pre"].filter((q) => c.querySelector(q)),
    };
  })()`);

// --- Checks ----------------------------------------------------------------------------------------------------------

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) passed++;
  else failures.push(`${name}: ${detail}`);
};
const clean = (html) => html.replace(/ style=""/g, "");

// 1. Every line-type button, in every kind of line, with every kind of selection: pressed, pressed again, undone.
const A = "alpha one",
  B = "beta two",
  G = "gamma three";
const CONTEXTS = {
  text: `<div>${A}</div><div>${B}</div><div>${G}</div>`,
  bullets: `<ul><li>${A}</li><li>${B}</li><li>${G}</li></ul>`,
  numbers: `<ol><li>${A}</li><li>${B}</li><li>${G}</li></ol>`,
  heading: `<div>${A}</div><h1>${B}</h1><div>${G}</div>`,
  code: `<div>${A}</div><pre>${B}</pre><div>${G}</div>`,
  "pell code": `<div>${A}</div><pre><code type="">${B}</code></pre><div>${G}</div>`,
};
const SELECTIONS = {
  caret: { caret: B, at: 2 },
  part: { text: B, from: 0, to: 4 },
  line: { text: B },
  "two lines": { from: [A, 3], to: [B, 4] },
};
for (const [ctxName, html] of Object.entries(CONTEXTS)) {
  for (const [selName, sel] of Object.entries(SELECTIONS)) {
    for (const [action, lineType] of Object.entries(LINE_TYPES)) {
      const name = `${action} on ${ctxName} (${selName})`;
      await open(html);
      await select(sel);
      const s0 = await state();
      // A line already of this type turns into text, any other one into this type (two lines: they all follow the first).
      const first = s0.lines[selName === "two lines" ? A : B];
      const t1 = first === lineType ? "p" : lineType;
      const t2 = t1 === lineType ? "p" : lineType;
      await press(action);
      const s1 = await state();
      await press(action);
      const s2 = await state();
      check(
        name,
        s1.lines[B] === t1 && s2.lines[B] === t2,
        `line ${s0.lines[B]} -> ${s1.lines[B]} -> ${s2.lines[B]}, expected -> ${t1} -> ${t2}\n    ${s1.html}\n    ${s2.html}`
      );
      if (selName === "two lines") check(name + ", first line", s1.lines[A] === t1, `${s1.lines[A]}, expected ${t1}`);
      check(
        name + ", nesting",
        !s1.nested.length && !s2.nested.length,
        `${s1.nested} ${s2.nested}\n    ${s1.html}\n    ${s2.html}`
      );
      check(name + ", font", s1.maxFont <= 32 && s2.maxFont <= 32, `${s1.maxFont}px / ${s2.maxFont}px`);
      check(
        name + ", text",
        s1.text === s0.text && s2.text === s0.text,
        `${JSON.stringify(s0.text)} -> ${JSON.stringify(s1.text)} -> ${JSON.stringify(s2.text)}`
      );
      check(
        name + ", other lines",
        s1.lines[G] === s0.lines[G] && s2.lines[G] === s0.lines[G],
        `${G}: ${s0.lines[G]} -> ${s1.lines[G]} -> ${s2.lines[G]}`
      );
      if (selName === "caret" && s0.lines[B] !== "code" && t1 !== "code")
        check(name + ", caret", s1.caret === s0.caret, `${s0.caret} -> ${s1.caret}`);
      if (ctxName === "pell code") continue; // its first press converts the old code markup, which undo keeps
      let s3 = s2;
      for (let i = 0; i < 6 && clean(s3.html) !== clean(s0.html); i++) {
        await press("undo");
        s3 = await state();
      }
      check(name + ", undo", clean(s3.html) === clean(s0.html), `${s0.html} -> ${s3.html}`);
    }
  }
}

// 2. Typing.
const IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const P3 = `<div>${A}</div><div>${B}</div><div>${G}</div>`;
const end = (text) => ({ caret: text, at: text.length });
const FLOWS = [
  [
    "Enter twice at the end of a code block leaves it",
    P3,
    [
      ["select", end(B)],
      ["press", "code"],
      ["key", "Enter"],
      ["type", "x"],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) =>
      s.lines[B] === "code" &&
      s.lines.x === "code" &&
      s.lines.out === "p" &&
      !/<br><\/pre>/.test(s.html.replace(/x<br><\/pre>/, "x</pre>")),
  ],
  [
    "Enter twice at the end of a code block that ends the note",
    `<div>${A}</div>`,
    [
      ["select", end(A)],
      ["press", "code"],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) => s.lines[A] === "code" && s.lines.out === "p",
  ],
  [
    "Enter twice in pell's code block",
    `<div>a</div><pre><code type="">${B}</code></pre><div>c</div>`,
    [
      ["select", end(B)],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) => s.lines[B] === "code" && s.lines.out === "p" && s.lines.c === "p" && !s.html.includes("<code"),
  ],
  [
    "Enter twice in a code block whose lines are in an inline element",
    `<div>a</div><pre><span style="font-size: 1em;">${B}</span></pre><div>c</div>`,
    [
      ["select", end(B)],
      ["key", "Enter"],
      ["type", "x"],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) =>
      s.lines[B] === "code" &&
      s.lines.x === "code" &&
      s.lines.out === "p" &&
      s.lines.c === "p" &&
      !/<br><br>(<\/span>)?<\/pre>/.test(s.html),
  ],
  [
    "A heading on a list item, off, then code: Enter twice leaves it",
    `<div>${A}</div><ul><li>${B}</li></ul>`,
    [
      ["select", end(B)],
      ["press", "heading1"],
      ["press", "heading1"],
      ["press", "code"],
      ["key", "Enter"],
      ["type", "x"],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) => s.lines[B] === "code" && s.lines.x === "code" && s.lines.out === "p",
  ],
  [
    "Enter after an image on the last line of a code block stays in it",
    `<pre>${B}<br><img src="${IMG}"></pre>`,
    [
      ["select", { after: "img" }],
      ["key", "Enter"],
    ],
    (s) => s.html.endsWith("</pre>") && /<img[^>]*><br>/.test(s.html) && !s.html.includes("<div"),
  ],
  [
    "Enter in a code block is a line of the block, not a new block",
    `<div>a</div><pre>l1</pre><div>c</div>`,
    [
      ["select", end("l1")],
      ["key", "Enter"],
      ["type", "x"],
    ],
    (s) => s.pres === 1 && s.pre === "l1\nx" && s.lines.c === "p",
  ],
  [
    "Enter twice at the end of a code block with \\n lines leaves it",
    `<div>a</div><pre>l1\nl2</pre><div>c</div>`,
    [
      ["select", end("l2")],
      ["key", "Enter"],
      ["key", "Enter"],
      ["type", "out"],
    ],
    (s) => s.pres === 1 && s.pre.replace(/\n$/, "") === "l1\nl2" && s.lines.out === "p" && s.lines.c === "p",
  ],
  [
    "A code block with \\n lines turns into text, a line each, the caret where it was",
    `<pre>l1\nl2</pre>`,
    [
      ["select", { caret: "l2", at: 1 }],
      ["press", "code"],
    ],
    (s) => s.html === "<div>l1<br>l2</div>" && s.caret === "l2@1",
  ],
  [
    "A code block with \\n lines turns into a list, an item per line",
    `<pre>l1\nl2</pre>`,
    [
      ["select", { caret: "l1", at: 1 }],
      ["press", "unorderedList"],
    ],
    (s) => s.lines.l1 === "ul" && s.lines.l2 === "ul" && (s.html.match(/<li>/g) || []).length === 2,
  ],
  [
    "Enter on an empty code block makes it text",
    `<div>a</div>`,
    [
      ["select", end("a")],
      ["key", "Enter"],
      ["press", "code"],
      ["key", "Enter"],
      ["type", "t"],
    ],
    (s) => s.lines.t === "p",
  ],
  [
    "Enter twice in the middle of a code block stays in it",
    `<pre>l1<br>l2</pre>`,
    [
      ["select", end("l1")],
      ["key", "Enter"],
      ["key", "Enter"],
    ],
    (s) => s.pres === 1 && /^<pre>[^]*<\/pre>$/.test(s.html) && s.pre === "l1\n\n\nl2",
  ],
  [
    "Leaving a code block is one undo",
    P3,
    [
      ["select", end(B)],
      ["press", "code"],
      ["key", "Enter"],
      ["key", "Enter"],
      ["press", "undo"],
    ],
    (s) =>
      s.lines[A] === "p" && s.lines[B] === "code" && s.lines[G] === "p" && s.pres === 1 && !s.html.includes("<div><br></div>"),
  ],
  [
    "Backspace at the start of a bullet takes the bullet off",
    `<ul><li>${A}</li><li>${B}</li></ul>`,
    [
      ["select", { caret: B, at: 0 }],
      ["key", "Backspace"],
    ],
    (s) => s.lines[A] === "ul" && s.lines[B] === "p" && s.caret === `${B}@0`,
  ],
  [
    "Backspace at the start of the first bullet",
    `<ul><li>${A}</li><li>${B}</li></ul>`,
    [
      ["select", { caret: A, at: 0 }],
      ["key", "Backspace"],
    ],
    (s) => s.lines[A] === "p" && s.lines[B] === "ul",
  ],
  [
    "A second Backspace joins the line to the bullet above",
    `<ul><li>${A}</li><li>${B}</li></ul>`,
    [
      ["select", { caret: B, at: 0 }],
      ["key", "Backspace"],
      ["key", "Backspace"],
    ],
    (s) => s.lines[A + B] === "ul",
  ],
  [
    "Bullets keep the caret where it was",
    P3,
    [
      ["select", end(B)],
      ["press", "unorderedList"],
      ["type", "!"],
    ],
    (s) => s.lines[B + "!"] === "ul",
  ],
  [
    "After an image the caret is on a new line under it",
    P3,
    [["select", end(B)], ["image"], ["type", "next"]],
    (s) => s.lines.next === "p" && s.lines[G] === "p" && s.html.includes(`${B}<img`) && !s.html.includes("</div><br>"),
  ],
  [
    "An image in an empty note",
    "",
    [["focus"], ["image"], ["type", "next"]],
    (s) => s.lines.next === "p" && /^(<div>)?<img[^>]*>(<\/div>)?<div>next<\/div>$/.test(s.html),
  ],
  [
    "H1 on a new line of a list",
    `<ul><li>${A}</li></ul>`,
    [
      ["select", end(A)],
      ["key", "Enter"],
      ["press", "heading1"],
      ["type", "T"],
    ],
    (s) => s.lines[A] === "ul" && s.lines.T === "h1",
  ],
];
for (const [name, html, steps, ok] of FLOWS) {
  await open(html);
  for (const [kind, arg] of steps) {
    if (kind === "select") await select(arg);
    else if (kind === "focus") await post({ type: "content", name: "focus" });
    else if (kind === "press") await press(arg);
    else if (kind === "key") await key(arg);
    else if (kind === "type") await type(arg);
    else if (kind === "image") await insertImage(IMG);
  }
  const s = await state();
  check(name, ok(s), s.html.replaceAll(IMG, "IMG"));
}

// 3. Notes saved before these fixes (as the HTML parser rebuilds them on load).
const SAVED = [
  [
    "A heading around a list turns back into the list",
    `<ul><li>a</li></ul><h1><ul><li>${B}</li></ul></h1>`,
    "heading1",
    (s) => s.lines[B] === "ul" && s.lines.a === "ul",
  ],
  [
    "A code block in a code block turns into text",
    `<div>a</div><pre><pre><code type="">${B}</code></pre></pre>`,
    "code",
    (s) => s.lines[B] === "p" && !s.nested.length,
  ],
  [
    "Pell's code block keeps its lines when turned into text",
    `<pre><code type="">l1</code><code type="">l2</code></pre>`,
    "code",
    (s) => s.html === "<div>l1<br>l2</div>",
  ],
  [
    "Pell's code block turns into a list, a line per item",
    `<pre><code type="">l1</code><code type="">l2</code></pre>`,
    "unorderedList",
    (s) => s.lines.l1 === "ul" && s.lines.l2 === "ul",
  ],
];
for (const [name, html, action, ok] of SAVED) {
  await open(html);
  await select({ caret: html.includes(B) ? B : "l1", at: 1 });
  await press(action);
  const s = await state();
  check(name, ok(s), s.html);
}

// 4. A read-only note (RichEditor's `disabled`): on web the toolbar stays on screen, and its buttons change nothing.
await open(`<div>a</div><pre><pre><code type="">${B}</code></pre></pre><h1><ul><li>${G}</li></ul></h1>`);
await post({ type: "content", name: "setDisable", data: true });
const readOnly = (await state()).html;
for (const [text, action] of [
  [B, "code"],
  [B, "heading1"],
  [G, "heading1"],
  [G, "unorderedList"],
]) {
  await select({ caret: text, at: 1 });
  await press(action);
}
check("A read-only note doesn't change", (await state()).html === readOnly, `${readOnly} -> ${(await state()).html}`);

// 5. Images: a tap asks the app for the image's menu (FASTMEMO_IMAGE), the app's choices come back as __fm.image().
// What the page posts to the app (pell posts to its parent: here the page itself).
const listenToPage = () =>
  evaluate(`(() => {
    window.__posted = [];
    window.addEventListener("message", (e) => {
      try { const m = JSON.parse(e.data); if (/^(FASTMEMO_IMAGE|CONTENT_CHANGE)/.test(m.type)) window.__posted.push(m); } catch (error) {}
    });
  })()`);
const posted = async (type) => {
  await sleep(150);
  return evaluate(`window.__posted.splice(0).filter((m) => m.type === ${JSON.stringify(type)})`);
};
// A photo-like image of w x h, as the app stores them.
const picture = (w, h, mime = "image/jpeg") =>
  evaluate(`(() => {
    const c = document.createElement("canvas"); c.width = ${w}; c.height = ${h};
    const g = c.getContext("2d"); g.fillStyle = "#3355aa"; g.fillRect(0, 0, ${w}, ${h}); g.fillStyle = "#ffcc00"; g.fillRect(0, 0, ${w / 2}, ${h / 2});
    return c.toDataURL(${JSON.stringify(mime)}, 0.7);
  })()`);
const imageCenter = () =>
  evaluate(
    `(() => { const r = document.querySelector(".pell-content img").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`
  );
const imageState = () =>
  evaluate(`(async () => {
    const img = document.querySelector(".pell-content img");
    if (!img) return null;
    await img.decode().catch(() => {});
    return { src: img.src, width: img.naturalWidth, height: img.naturalHeight, size: img.style.width, align: getComputedStyle(img.parentNode).textAlign };
  })()`);
// What NoteTextEditor runs for a choice in the menu.
const imageChange = (image, change, value) =>
  post({
    type: "content",
    name: "command",
    data: `window.__fm && window.__fm.image(${image.index}, ${JSON.stringify(image.key)}, ${JSON.stringify(change)}, ${JSON.stringify(value ?? null)})`,
  });

const JPEG = await picture(80, 40);
const PNG = await picture(80, 40, "image/png");
const imageNote = (src) => `<div>a</div><div><img src="${src}"></div><div>b</div>`;

await open(imageNote(JPEG));
await listenToPage();
await select({ caret: "a", at: 1 });
let [x, y] = await imageCenter();
await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
let asked = await posted("FASTMEMO_IMAGE");
const tapped = asked[0]?.data ?? { index: 0, key: "" }; // without the message, the checks below fail instead of throwing
check(
  "A click on an image asks the app for its menu, once",
  asked.length === 1 &&
    tapped.index === 0 &&
    tapped.src === JPEG &&
    tapped.width === 80 &&
    tapped.height === 40 &&
    tapped.editable === true &&
    Math.abs(tapped.x - x) < 2 &&
    Math.abs(tapped.y - y) < 2,
  asked
);
check("A click on an image leaves the caret where it was", (await state()).caret === "a@1", (await state()).caret);

await imageChange(tapped, "size", "50%");
check("Size: the image gets a width of the note's", (await imageState()).size === "50%", await imageState());
check(
  "Size: the note is saved",
  (await posted("CONTENT_CHANGE")).some((m) => m.data.includes("50%")),
  "no CONTENT_CHANGE with the width"
);
await press("undo");
check("Size: undo", (await imageState()).size === "", await imageState());

await imageChange(tapped, "align", "center");
check("Align: the image's line is centered", (await imageState()).align === "center", await imageState());
await imageChange(tapped, "align", "right");
check("Align: right", (await imageState()).align === "right", await imageState());
await press("undo");
await press("undo");
check("Align: undo", !/center|right/.test((await imageState()).align), await imageState());

await imageChange(tapped, "size", "25%");
// a width doesn't change the image's key (its data)
await imageChange(tapped, "rotate");
let rotatedImage = await imageState();
check(
  "Rotate: a quarter turn, still a JPEG, the size kept",
  rotatedImage.width === 40 &&
    rotatedImage.height === 80 &&
    rotatedImage.src.startsWith("data:image/jpeg") &&
    rotatedImage.size === "25%",
  { ...rotatedImage, src: rotatedImage.src.slice(0, 30) }
);
await press("undo");
check("Rotate: undo", (await imageState()).width === 80 && (await imageState()).size === "25%", await imageState());

await open(imageNote(JPEG));
await imageChange(tapped, "rotate");
await imageChange(tapped, "delete");
check("A choice made on an image that changed since does nothing", (await imageState())?.width === 40, await imageState());

await open(imageNote(JPEG));
await imageChange(tapped, "delete");
check(
  "Delete: the image is gone, the lines around it stay",
  !(await imageState()) && /a[^]*b/.test((await state()).text),
  (await state()).html
);
await press("undo");
check("Delete: undo", (await imageState())?.src === JPEG, await imageState());

await open(imageNote(PNG));
await imageChange({ ...tapped, key: `${PNG.length}:${PNG.slice(-32)}` }, "rotate");
check(
  "Rotate: a PNG turns and stays a PNG (its transparency)",
  (await imageState()).src.startsWith("data:image/png") && (await imageState()).width === 40,
  (await imageState()).src.slice(0, 30)
);

// A change works on the image selected: then the caret goes back where it was, not next to the image (or on it, where a
// key would replace it).
const caretAfterImage = () =>
  evaluate(`(() => {
    const s = getSelection(), r = document.createRange();
    r.setStartAfter(document.querySelector(".pell-content img"));
    return s.isCollapsed && s.getRangeAt(0).compareBoundaryPoints(Range.START_TO_START, r) === 0;
  })()`);
for (const [change, value] of [["size", "50%"], ["align", "center"], ["rotate"], ["delete"]]) {
  await open(imageNote(JPEG));
  await select({ caret: "b", at: 1 });
  await imageChange(tapped, change, value);
  check(`${change}: the caret stays where it was`, (await state()).caret === "b@1", (await state()).caret);
}
for (const [change, value] of [["size", "50%"], ["align", "center"], ["rotate"]]) {
  await open(imageNote(JPEG));
  await select({ after: "img" });
  await imageChange(tapped, change, value);
  check(`${change}: a caret right after the image stays after it`, await caretAfterImage(), (await state()).caret);
}
await open(imageNote(JPEG));
await imageChange(tapped, "size", "50%");
check(
  "A change in a note that isn't being edited leaves it so (no keyboard on the phone)",
  (await imageState()).size === "50%" &&
    (await evaluate(`document.activeElement !== document.querySelector(".pell-content") && !getSelection().rangeCount`)),
  await evaluate(`[document.activeElement.className, getSelection().rangeCount]`)
);

await open(imageNote(JPEG));
await listenToPage();
await post({ type: "content", name: "setDisable", data: true });
[x, y] = await imageCenter();
await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
asked = await posted("FASTMEMO_IMAGE");
check(
  "A read-only note's image asks for its menu, not editable",
  asked.length === 1 && asked[0].data.editable === false,
  asked
);
await imageChange(tapped, "delete");
check("A read-only note's image doesn't change", (await imageState())?.src === JPEG, await imageState());

// A finger, as on the phone: a tap opens the menu (no caret, no keyboard), a touch that scrolls doesn't.
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
await open(imageNote(JPEG));
await listenToPage();
await select({ caret: "b", at: 1 });
[x, y] = await imageCenter();
await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
asked = await posted("FASTMEMO_IMAGE");
check("A tap on an image asks for its menu, once", asked.length === 1 && asked[0].data.index === 0, asked);
check("A tap on an image leaves the caret where it was", (await state()).caret === "b@1", (await state()).caret);
await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 30 }] });
await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
check("A touch that scrolls over an image doesn't open its menu", !(await posted("FASTMEMO_IMAGE")).length, "asked");
await send("Emulation.setTouchEmulationEnabled", { enabled: false });

check("the note sanitizer was in the page", await evaluate("typeof window.__fmSanitize === 'function'"), "missing");
check("no page errors", !pageErrors.length, pageErrors.join("\n"));

ws.close();
// Chrome writes its profile until it has exited
const exited = new Promise((resolve) => chrome.once("exit", resolve));
chrome.kill();
await exited;
rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("✗ " + f);
process.exit(failures.length ? 1 : 0);
