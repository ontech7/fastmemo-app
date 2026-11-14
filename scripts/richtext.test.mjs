// Text editor test: the real pell page (createHTML with the app's options and CSS, the note sanitizer, RICH_TEXT_SCRIPT),
// driven the way the app drives it: toolbar presses are the same messages RichEditor posts, keys are real key events.
// Run: node scripts/richtext.test.mjs   (headless Chrome; CHROME=/path/to/chrome to use another one)
// scripts/richtext-webkit.test.mjs runs the same cases in Safari (runCases below); the page and the browsers are in
// scripts/lib/richtextPage.mjs.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { EVERY_LINE, EVERY_LINE_TEXT, TODO_BOX as BOX, TODO_BOX_DONE as DONE } from "./lib/everyLine.mjs";
import { buildPage, chromeDriver } from "./lib/richtextPage.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every case, in `driver` (chromeDriver or safariDriver) on `page` (buildPage's) loaded from `url`. A case that needs
 * what only Chrome's protocol does (touches, a composition) is skipped by name in a browser that can't.
 */
export async function runCases(driver, page, url) {
  const {
    COUNT_MESSAGE,
    EDITOR_SANITIZE_JS,
    PAGE_ERROR_SCRIPT,
    PAGE_ERROR_MESSAGE,
    RICH_TEXT_SCRIPT,
    formatCommand,
    getTextLength,
    imageCommand,
    LINK_MESSAGE,
    LINK_START_COMMAND,
    LINK_CANCEL_COMMAND,
    LINK_START_MESSAGE,
    linkCommand,
    UNLINK_COMMAND,
    PICKER_MESSAGE,
    PICKER_KEY_MESSAGE,
    FIND_ESCAPE_MESSAGE,
    FIND_PAGE,
    NOTE_LINK_MESSAGE,
    noteLinkCommand,
    PICKER_CLOSE_COMMAND,
    PICK_START_COMMAND,
    pickerShownCommand,
    STATE_MESSAGE,
    TOUCH_MESSAGE,
  } = page.scripts;
  const evaluate = (expression) => driver.evaluate(expression);
  const pageErrors = driver.pageErrors;
  const skipped = [];
  // The protocol's input events the cases send, through the driver.
  const send = (method, params = {}) => {
    if (method === "Input.dispatchMouseEvent") return driver.mouse(params);
    if (method === "Input.dispatchTouchEvent") return driver.touch(params);
    if (method === "Input.insertText") return driver.type(params.text);
    throw new Error(`not routed: ${method}`);
  };

  // What RichEditor.sendAction does: a JSON message to the page. 90 ms covers pell's 50 ms state timer.
  const post = async (msg) => {
    await evaluate(`window.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(JSON.stringify(msg))} }))`);
    await sleep(90);
  };
  const open = async (html) => {
    await driver.goto(url);
    // NoteTextEditor's injectedJavaScript: the page's error forwarder, then the sanitizer, before the note (LL-060)
    await evaluate(`${PAGE_ERROR_SCRIPT}\n${EDITOR_SANITIZE_JS}`);
    await post({ type: "content", name: "setHtml", data: html });
    await post({ type: "content", name: "command", data: RICH_TEXT_SCRIPT });
  };
  // The toolbar: the line types go to the page script (after focusContentEditor), the rest to pell, as NoteTextEditor does.
  const LINE_TYPES = {
    heading1: "h1",
    heading2: "h2",
    quote: "quote",
    code: "code",
    unorderedList: "ul",
    orderedList: "ol",
    checkboxList: "todo",
  };
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
  })()`).then(
      () => sleep(90),
      // a text that isn't there is a failure of the case, not of the run (another engine can leave other text)
      (error) => failures.push(`select ${JSON.stringify(spec)}: ${String(error.message).split("\n")[0]}`)
    );
  const KEYS = {
    Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
    Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, commands: ["deleteBackward"] },
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40, commands: ["moveDown"] },
    ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, commands: ["moveLeft"] },
    Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
    Delete: { key: "Delete", code: "Delete", windowsVirtualKeyCode: 46, commands: ["deleteForward"] },
  };
  const key = async (name) => {
    await driver.key(KEYS[name]);
    await sleep(90);
  };
  const type = async (text) => {
    await driver.type(text);
    await sleep(90);
  };
  // The content, the type of each line by its text (a code block's lines can be "\n" in one text node), the code blocks
  // and the first one's lines as shown, the caret, and the biggest font on screen.
  const state = () =>
    evaluate(`(() => {
    const c = document.querySelector(".pell-content"), s = getSelection();
    const kindOf = (e) => {
      const li = e.closest("li");
      if (e.closest("pre")) return "code";
      if (e.closest("h1")) return "h1";
      if (e.closest("h2")) return "h2";
      if (li) return li.parentNode.nodeName === "OL" ? (li.parentNode.classList.contains("x-todo") ? "todo" : "ol") : "ul";
      if (e.closest("blockquote")) return "quote";
      return "p";
    };
    const lines = {};
    // the kind of each line by its whole text (a line's text can be in several nodes: "con <b>grassetto</b>")
    const blocks = {};
    for (const e of c.querySelectorAll("li, :scope > div, :scope > p, :scope > h1, :scope > h2, :scope > blockquote, :scope > pre"))
      if (e.textContent.trim()) blocks[e.textContent.trim()] = kindOf(e);
    // a checkbox item holds one box, its first child; no box anywhere else
    const items = [...c.querySelectorAll("ol.x-todo > li")];
    const boxes = items.every((li) => li.querySelectorAll(".x-todo-box").length === 1 && li.firstChild?.classList?.contains("x-todo-box")) &&
      c.querySelectorAll(".x-todo-box").length === items.length;
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const type = kindOf(n.parentNode);
      for (const line of n.data.split("\\n")) if (line.trim()) lines[line.trim()] = type;
    }
    const f = s.focusNode;
    return {
      html: c.innerHTML,
      text: c.textContent,
      lines,
      blocks,
      boxes,
      pres: c.querySelectorAll("pre").length,
      // a single line break at the end of a block shows no line
      pre: c.querySelector("pre") && c.querySelector("pre").innerText,
      caret: f ? (f.nodeType === 3 ? f.data : f.nodeName) + "@" + s.focusOffset : null,
      maxFont: Math.max(...[...c.querySelectorAll("*")].map((e) => parseFloat(getComputedStyle(e).fontSize)), 16),
      nested: [
        "h1 h1", "pre pre", "h1 pre", "pre h1", "h1 ul", "h1 ol", "pre ul", "pre ol", "li h1", "li pre",
        "h2 h2", "h1 h2", "h2 h1", "blockquote blockquote", "blockquote ul", "blockquote ol", "li blockquote", "li h2",
        "pre h2", "pre blockquote",
      ].filter((q) => c.querySelector(q)),
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
    heading2: `<div>${A}</div><h2>${B}</h2><div>${G}</div>`,
    quote: `<div>${A}</div><blockquote>${B}</blockquote><div>${G}</div>`,
    checks: `<ol class="x-todo"><li>${BOX}${A}</li><li>${DONE}${B}</li><li>${BOX}${G}</li></ol>`,
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
        check(name + ", boxes", s1.boxes && s2.boxes, `${s1.html}\n    ${s2.html}`);
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
      // WebKit writes a code block's new line as "\n", Chrome as <br>
      (s) => s.html.endsWith("</pre>") && /<img[^>]*>(<br>|\n)/.test(s.html) && !s.html.includes("<div"),
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
        s.lines[A] === "p" &&
        s.lines[B] === "code" &&
        s.lines[G] === "p" &&
        s.pres === 1 &&
        !s.html.includes("<div><br></div>"),
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
      // WebKit keeps the joined text in a font-size span (it does on any join of two lines): still the bullet's line
      (s) => s.lines[A + B] === "ul" || new RegExp(`^<ul><li>${A}<span[^>]*>${B}</span></li></ul>$`).test(s.html),
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
    post({ type: "content", name: "command", data: imageCommand(image, change, value) });
  const keyOf = (src) => `${src.length}:${src.slice(-32)}`;
  const clickImage = async () => {
    const [cx, cy] = await imageCenter();
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 });
    return posted("FASTMEMO_IMAGE");
  };

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
      tapped.alignable === true &&
      tapped.rotatable === true &&
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
  await imageChange({ ...tapped, key: keyOf(PNG) }, "rotate");
  check(
    "Rotate: a PNG turns and stays a PNG (its transparency)",
    (await imageState()).src.startsWith("data:image/png") && (await imageState()).width === 40,
    (await imageState()).src.slice(0, 30)
  );

  // A change works on the image selected: then the caret goes back where it was, not next to the image (or on it, where a
  // key would replace it).
  const caretAfter = (selector = "img") =>
    evaluate(`(() => {
    const s = getSelection(), r = document.createRange(), n = document.querySelector(".pell-content ${selector}");
    if (!n) return false;
    r.setStartAfter(n);
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
    check(`${change}: a caret right after the image stays after it`, await caretAfter(), (await state()).caret);
  }
  // A link around the image (alone or with text) stays: an insertHTML of the image alone dropped it.
  const LINK = 'a[href="https://x.y/"]';
  for (const inLink of ["", "l"]) {
    for (const [change, value] of [["size", "50%"], ["rotate"]]) {
      const name = `${change}: a link around the image${inLink ? " and some text" : ""} stays`;
      await open(`<div>a</div><div><a href="https://x.y/">${inLink}<img src="${JPEG}"></a></div><div>b</div>`);
      await select({ caret: "a", at: 1 });
      await imageChange(tapped, change, value);
      const changed = change === "size" ? (await imageState()).size === "50%" : (await imageState()).width === 40;
      const linked = await evaluate(`!!document.querySelector('.pell-content ${LINK} img')`);
      check(name, changed && linked && (await state()).caret === "a@1", (await state()).html.replace(/data:[^"]*/g, "DATA"));
      await press("undo");
      check(`${name}, undo`, (await imageState()).src === JPEG && (await imageState()).size === "", await imageState());
    }
  }
  await open(`<div>a</div><div><a href="https://x.y/"><img src="${JPEG}"></a></div><div>b</div>`);
  await select({ after: "a" });
  await imageChange(tapped, "size", "50%");
  check("size: a caret right after a linked image stays after its link", await caretAfter("a"), (await state()).caret);

  // A turn keeps a JPEG about its size: the picker stores JPEG at 0.3, which came out up to twice as big at 0.7 (notes have a
  // size limit).
  const NOISY = await evaluate(`(() => {
  const c = document.createElement("canvas"); c.width = 300; c.height = 200;
  const g = c.getContext("2d"), d = g.createImageData(300, 200);
  for (let i = 0; i < d.data.length; i++) d.data[i] = i % 4 === 3 ? 255 : (Math.random() * 256) | 0;
  g.putImageData(d, 0, 0);
  return c.toDataURL("image/jpeg", 0.3);
})()`);
  await open(imageNote(NOISY));
  await imageChange({ index: 0, key: keyOf(NOISY) }, "rotate");
  check(
    "Rotate: a JPEG at the picker's quality stays about its size",
    (await imageState()).width === 200 && (await imageState()).src.length <= NOISY.length * 1.15,
    `${NOISY.length} -> ${(await imageState()).src.length}`
  );

  // What can't be done to an image isn't offered, and does nothing if asked.
  await open(`<pre>a\n<img src="${JPEG}">\nb</pre>`);
  await listenToPage();
  asked = await clickImage();
  check(
    "An image in a code block can't be aligned (a code block stays a plain <pre>)",
    asked[0]?.data.alignable === false,
    asked
  );
  let html = (await state()).html;
  await imageChange(tapped, "align", "center");
  check(
    "Align does nothing in a code block",
    (await state()).html === html,
    (await state()).html.replace(/data:[^"]*/g, "DATA")
  );
  const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  await open(`<div>a</div><div><img src="${GIF}" style="width: 50%;"></div>`);
  await listenToPage();
  asked = await clickImage();
  check("A GIF can't be turned (it would stop moving)", asked[0]?.data.rotatable === false, asked);
  await imageChange({ index: 0, key: keyOf(GIF) }, "rotate");
  check("Rotate does nothing on a GIF", (await imageState())?.src === GIF, "changed");

  await open(imageNote(JPEG));
  await imageChange({ ...tapped, index: "0); window.__ran = true; (0" }, "delete");
  check("A message's values can't run code in the page", !(await evaluate("window.__ran === true")), "it ran");

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
  if (!driver.can.touch) skipped.push("a finger on an image (touch events)");
  else {
    await driver.touchEmulation(true);
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
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await sleep(600);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    check(
      "A long press on an image is the browser's (selection), not the menu",
      !(await posted("FASTMEMO_IMAGE")).length,
      "asked"
    );
    await driver.touchEmulation(false);
  }

  // A read-only note is the same page with contenteditable="false" (RichEditor's `disabled`), which drops the wrapping the
  // browser gives an editable element: a long word (a link, a key) has to wrap there too, never scroll sideways.
  const LONG_WORD = "sk-" + "A1b2C3d4".repeat(40);
  await open(`<div>Short line</div><div>${LONG_WORD}</div><div>https://example.com/${"segment_".repeat(40)}</div>`);
  const sideways = () =>
    evaluate(`(() => { const c = document.querySelector(".pell-content"); return c.scrollWidth - c.clientWidth; })()`);
  check("A long word wraps in an editable note", (await sideways()) <= 0, `${await sideways()} px sideways`);
  await post({ type: "content", name: "setDisable", data: true });
  check("A long word wraps in a read-only note too", (await sideways()) <= 0, `${await sideways()} px sideways`);
  await post({ type: "content", name: "setDisable", data: false });

  // The page is a document of its own (an iframe on desktop): the app's scrollbar (global.css) has to be in it, or it shows
  // the system's, light on Windows.
  const appCss = readFileSync(join(root, "src/styles/global.css"), "utf8");
  const missingScrollbarRules = await evaluate(`(() => {
  const app = new CSSStyleSheet();
  app.replaceSync(${JSON.stringify(appCss)});
  const mine = [...document.styleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText));
  return [...app.cssRules].map((r) => r.cssText).filter((r) => r.includes("scrollbar") && !mine.includes(r));
})()`);
  check("The text editor has the app's scrollbar", !missingScrollbarRules.length, missingScrollbarRules.join("\n"));

  // Cmd+B/I/U on a Mac, Ctrl elsewhere. WebKit on macOS leaves them to an app's Format menu, which the desktop app doesn't
  // have, so the page does them itself. A synthetic key (no browser default) proves it's the page; Ctrl on a Mac moves the
  // caret (Ctrl+B is one character back), it doesn't style.
  const mac = await evaluate("/Mac/.test(navigator.platform)");
  const styleKey = (key, mods) =>
    evaluate(`(() => {
    const e = new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, code: "Key" + ${JSON.stringify(key.toUpperCase())},
      metaKey: ${!!mods.meta}, ctrlKey: ${!!mods.ctrl}, shiftKey: ${!!mods.shift}, bubbles: true, cancelable: true });
    document.querySelector(".pell-content").dispatchEvent(e);
    return e.defaultPrevented;
  })()`).then((prevented) => sleep(90).then(() => prevented));
  const mod = mac ? { meta: true } : { ctrl: true };
  for (const [key, tag] of [
    ["b", "b"],
    ["i", "i"],
    ["u", "u"],
  ]) {
    await open("<div>one two</div>");
    await select({ text: "two" });
    await styleKey(key, mod);
    const html = (await state()).html;
    check(`${mac ? "Cmd" : "Ctrl"}+${key.toUpperCase()} styles the selection`, html.includes(`<${tag}>two</${tag}>`), html);
  }
  // A real key: Chromium's own bold must not run too, or the two would cancel out.
  await open("<div>one two</div>");
  await select({ text: "two" });
  const realB = { key: "b", code: "KeyB", windowsVirtualKeyCode: 66, modifiers: mac ? 4 : 2 };
  await driver.key(realB);
  await sleep(90);
  check("A real Cmd/Ctrl+B makes the selection bold once", (await state()).html.includes("<b>two</b>"), (await state()).html);
  await open("<div>one two</div>");
  await select({ text: "two" });
  await styleKey("b", mac ? { ctrl: true } : { meta: true });
  check("The other modifier's B doesn't style", !/<b>/.test((await state()).html), (await state()).html);
  await styleKey("b", { ...mod, shift: true });
  check("Shift with the shortcut doesn't style", !/<b>/.test((await state()).html), (await state()).html);
  await post({ type: "content", name: "setDisable", data: true });
  await select({ text: "two" });
  await styleKey("b", mod);
  check("A read-only note isn't styled by the shortcut", !/<b>/.test((await state()).html), (await state()).html);
  await post({ type: "content", name: "setDisable", data: false });

  // An error in the page reaches the app, without the document (ADR-035). The page has no parent here: the app's side is
  // the WebView bridge.
  {
    await open("<div>segreto 12345</div>");
    await evaluate(`window.__pageMsgs = []; window.ReactNativeWebView = { postMessage: (m) => window.__pageMsgs.push(m) }`);
    await evaluate(`setTimeout(() => { throw new Error("boom from the page"); }, 0)`);
    await sleep(100);
    const forwardedAll = (await evaluate("window.__pageMsgs"))
      .map((m) => JSON.parse(m))
      .filter((m) => m.type === PAGE_ERROR_MESSAGE);
    const forwarded = forwardedAll[0];
    check(
      "an error in the page is forwarded",
      forwarded?.data?.message?.includes("boom from the page"),
      JSON.stringify(forwardedAll)
    );
    check(
      "only message, file, line",
      forwarded && Object.keys(forwarded.data).sort().join() === "file,line,message",
      JSON.stringify(forwarded)
    );
    check("nothing of the note", forwarded && !JSON.stringify(forwarded).includes("segreto"), JSON.stringify(forwarded));
    // From a timer: an evaluated promise would be awaited by DevTools, so handled.
    await evaluate(`setTimeout(() => { Promise.reject(new Error("rejected in the page")); }, 0)`);
    await sleep(100);
    const rejected = (await evaluate("window.__pageMsgs"))
      .map((m) => JSON.parse(m))
      .filter((m) => m.type === PAGE_ERROR_MESSAGE);
    check(
      "an unhandled rejection is forwarded",
      rejected.some((m) => m.data.message === "rejected in the page"),
      JSON.stringify(rejected)
    );
    await evaluate(PAGE_ERROR_SCRIPT);
    await evaluate(`setTimeout(() => { throw new Error("once") }, 0)`);
    await sleep(100);
    const once = (await evaluate("window.__pageMsgs"))
      .map((m) => JSON.parse(m))
      .filter((m) => /\bonce$/.test(m.data?.message ?? ""));
    check("installed twice, forwarded once", once.length === 1, JSON.stringify(once));
    await evaluate("delete window.ReactNativeWebView");
    // The errors thrown on purpose are not the page's own (a driver that reads them later reads them now).
    await driver.flushErrors?.();
    for (let i = pageErrors.length - 1; i >= 0; i--)
      if (/boom from the page|rejected in the page|once/.test(pageErrors[i] ?? "")) pageErrors.splice(i, 1);
  }

  // 7. The character count: the page counts what it shows (COUNT_MESSAGE) after every change, whoever made it, so the app
  // doesn't parse the note at each pause (spec 3.3).
  {
    const listenToCounts = () =>
      evaluate(`(() => {
      window.__counts = [];
      window.addEventListener("message", (e) => {
        try { const m = JSON.parse(e.data); if (m.type === ${JSON.stringify(COUNT_MESSAGE)}) window.__counts.push(m.data); } catch (error) {}
      });
    })()`);
    const countsAfter = async (action) => {
      await evaluate("window.__counts.length = 0");
      await action();
      await sleep(400);
      return evaluate("window.__counts.slice()");
    };
    const last = (list) => list[list.length - 1];
    const setContent = (html) => post({ type: "content", name: "setHtml", data: html });

    // As NoteTextEditor loads the page: the note, then the script, which counts once when it installs.
    await driver.goto(url);
    await evaluate(`${PAGE_ERROR_SCRIPT}\n${EDITOR_SANITIZE_JS}`);
    await listenToCounts();
    let counts = await countsAfter(async () => {
      await setContent("<div>abc</div>");
      await post({ type: "content", name: "command", data: RICH_TEXT_SCRIPT });
    });
    check("the page counts once when the script installs", counts.length === 1 && counts[0] === 3, JSON.stringify(counts));

    counts = await countsAfter(async () => {
      await setContent("");
      await post({ type: "content", name: "focus" });
      await type("ciao");
    });
    check("after typing", last(counts) === 4, JSON.stringify(counts));
    counts = await countsAfter(() => setContent("<div>uno</div><div>due</div>"));
    check("after the app sets the content", last(counts) === 6, JSON.stringify(counts));
    for (const html of [
      "<div>ciao mondo</div>",
      "<h1>Titolo</h1><div>te<b>st</b>o</div>",
      "<div>riga<br>riga</div>",
      "<div>caffè 😀</div>",
    ]) {
      counts = await countsAfter(() => setContent(html));
      check(
        `same number as the app's own count: ${html}`,
        last(counts) === getTextLength(html),
        `${JSON.stringify(counts)} vs ${getTextLength(html)}`
      );
    }
    counts = await countsAfter(() =>
      setContent('<ul><li>uno</li><li>due</li></ul><div><img src="data:image/png;base64,iVBORw0KGgo="></div>')
    );
    check("list items count their text, an image counts nothing", last(counts) === 6, JSON.stringify(counts));

    counts = await countsAfter(async () => {
      await setContent("<div>x</div>");
      await select(end("x"));
      for (const ch of "abcdefghij") await type(ch);
    });
    check(
      "a burst of typing posts far fewer counts than keystrokes",
      counts.length >= 1 && counts.length <= 3 && last(counts) === 11,
      JSON.stringify(counts)
    );
  }

  // 8. The kinds of line added in 4.1.0 (spec B.2): heading 2, quote, checkbox lines, a rule. A checkbox list is the editor
  // library's own markup, so a 4.0.0 device keeps it.
  {
    const clickBox = async (index) => {
      const [bx, by] = await evaluate(
        `(() => { const r = document.querySelectorAll(".pell-content .x-todo-box input")[${index}].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: bx, y: by, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: bx, y: by, button: "left", clickCount: 1 });
      await sleep(90);
    };
    const run = async ([kind, arg]) => {
      if (kind === "select") await select(arg);
      else if (kind === "press") await press(arg);
      else if (kind === "key") await key(arg);
      else if (kind === "type") await type(arg);
      else if (kind === "click") await clickBox(arg);
      else if (kind === "rule") await post({ type: "content", name: "command", data: "window.__fm.rule()" });
      else if (kind === "readOnly") await post({ type: "content", name: "setDisable", data: true });
    };
    const sanitized = (html) => evaluate(`window.__fmSanitize(${JSON.stringify(html)})`);
    const three = `<div>${A}</div><div>${B}</div><div>${G}</div>`;
    const CHECKS = CONTEXTS.checks;
    const html = (s) => clean(s.html);
    const CASES = [
      {
        name: "text to checkbox",
        start: `<div>${A}</div>`,
        steps: [
          ["select", { caret: A, at: 5 }],
          ["press", "checkboxList"],
        ],
        ok: (s) => html(s) === `<ol class="x-todo"><li>${BOX}${A}</li></ol>` && s.caret === `${A}@5`,
      },
      {
        name: "three lines at once",
        start: three,
        steps: [
          ["select", { from: [A, 0], to: [G, G.length] }],
          ["press", "checkboxList"],
        ],
        // the selection still from the first character to the last
        ok: async (s) =>
          html(s) === `<ol class="x-todo"><li>${BOX}${A}</li><li>${BOX}${B}</li><li>${BOX}${G}</li></ol>` &&
          (await evaluate("getSelection().toString().replace(/\\s+/g, '')")) === `${A}${B}${G}`.replace(/\s+/g, ""),
      },
      {
        name: "checkbox to bullets",
        start: CHECKS,
        steps: [
          ["select", { caret: A, at: 1 }],
          ["press", "unorderedList"],
        ],
        ok: (s) =>
          html(s) === `<ul><li>${A}</li></ul><ol class="x-todo"><li>${DONE}${B}</li><li>${BOX}${G}</li></ol>` && s.boxes,
      },
      {
        name: "checkbox to bullets and back",
        start: CHECKS,
        steps: [
          ["select", { caret: A, at: 1 }],
          ["press", "unorderedList"],
          ["press", "checkboxList"],
        ],
        ok: (s) => html(s) === CHECKS,
      },
      {
        name: "tick",
        start: CHECKS,
        steps: [["click", 0]],
        content: true,
        ok: (s) => (s.html.match(/checked=""/g) || []).length === 2 && s.html.startsWith(`<ol class="x-todo"><li>${DONE}${A}`),
      },
      { name: "untick", start: CHECKS, steps: [["click", 1]], ok: (s) => !s.html.includes("checked") },
      {
        name: "tick in a read-only note",
        start: CHECKS,
        steps: [["readOnly"], ["click", 0]],
        content: false,
        ok: (s) => s.html === CHECKS,
      },
      {
        name: "Enter in a checkbox line",
        start: `<ol class="x-todo"><li>${BOX}alpha</li></ol>`,
        steps: [
          ["select", end("alpha")],
          ["key", "Enter"],
          ["type", "x"],
        ],
        ok: (s) => html(s) === `<ol class="x-todo"><li>${BOX}alpha</li><li>${BOX}x</li></ol>`,
      },
      {
        name: "Enter in a ticked line",
        start: `<ol class="x-todo"><li>${DONE}alpha</li></ol>`,
        steps: [
          ["select", end("alpha")],
          ["key", "Enter"],
          ["type", "x"],
        ],
        ok: (s) => html(s) === `<ol class="x-todo"><li>${DONE}alpha</li><li>${BOX}x</li></ol>`,
      },
      {
        name: "Enter on an empty box",
        start: `<ol class="x-todo"><li>${BOX}alpha</li></ol>`,
        steps: [
          ["select", end("alpha")],
          ["key", "Enter"],
          ["key", "Enter"],
          ["type", "y"],
        ],
        ok: (s) => html(s) === `<ol class="x-todo"><li>${BOX}alpha</li></ol><div>y</div>`,
      },
      {
        name: "Backspace after the box",
        start: CHECKS,
        steps: [
          ["select", { caret: B, at: 0 }],
          ["key", "Backspace"],
        ],
        ok: (s) =>
          html(s) === `<ol class="x-todo"><li>${BOX}${A}</li></ol><div>${B}</div><ol class="x-todo"><li>${BOX}${G}</li></ol>`,
      },
      {
        name: "heading 2",
        start: `<div>${A}</div>`,
        steps: [
          ["select", { caret: A, at: 2 }],
          ["press", "heading2"],
        ],
        ok: (s) => html(s) === `<h2>${A}</h2>`,
      },
      {
        name: "heading 2, pressed again",
        start: `<div>${A}</div>`,
        steps: [
          ["select", { caret: A, at: 2 }],
          ["press", "heading2"],
          ["press", "heading2"],
        ],
        ok: (s) => html(s) === `<div>${A}</div>`,
      },
      {
        name: "Enter after a heading 2",
        start: "<h2>alpha</h2>",
        steps: [
          ["select", end("alpha")],
          ["key", "Enter"],
          ["type", "x"],
        ],
        ok: (s) => html(s) === "<h2>alpha</h2><div>x</div>",
      },
      {
        name: "quote",
        start: `<div>${A}</div>`,
        steps: [
          ["select", { caret: A, at: 2 }],
          ["press", "quote"],
        ],
        ok: (s) => html(s) === `<blockquote>${A}</blockquote>`,
      },
      {
        name: "quote, pressed again",
        start: `<div>${A}</div>`,
        steps: [
          ["select", { caret: A, at: 2 }],
          ["press", "quote"],
          ["press", "quote"],
        ],
        ok: (s) => html(s) === `<div>${A}</div>`,
      },
      {
        name: "Enter in a quote",
        start: "<blockquote>alpha</blockquote>",
        steps: [
          ["select", end("alpha")],
          ["key", "Enter"],
          ["type", "x"],
          ["key", "Enter"],
          ["key", "Enter"],
          ["type", "y"],
        ],
        ok: (s) =>
          s.blocks.alpha === "quote" &&
          s.blocks.x === "quote" &&
          s.blocks.y === "p" &&
          html(s).endsWith("<div>y</div>") &&
          !s.nested.length,
      },
      {
        name: "rule",
        start: `<div>${A}</div><div>${B}</div>`,
        steps: [["select", { caret: A, at: 3 }], ["rule"], ["type", "x"]],
        ok: (s) => html(s) === `<div>${A}</div><hr><div>x</div><div>${B}</div>`,
      },
      {
        name: "rule in a code block",
        start: "<pre>alpha</pre>",
        steps: [["select", { caret: "alpha", at: 2 }], ["rule"]],
        ok: (s) => s.html === "<pre>alpha</pre>",
      },
      {
        name: "an old checkbox list",
        start: `<ol class="x-todo"><li>${DONE}fatto</li></ol>`,
        steps: [],
        ok: async (s) =>
          s.lines.fatto === "todo" &&
          (await evaluate(`getComputedStyle(document.querySelector(".pell-content li")).textDecorationLine`)) ===
            "line-through",
      },
      {
        name: "every kind together",
        start: EVERY_LINE,
        steps: [],
        ok: (s) =>
          EVERY_LINE_TEXT.every(
            (text, i) => s.blocks[text] === ["p", "h1", "h2", "quote", "code", "ul", "ol", "todo", "todo", "p"][i]
          ) && s.html === EVERY_LINE,
      },
    ];
    for (const c of CASES) {
      await open(c.start);
      await listenToPage();
      for (const step of c.steps) await run(step);
      const s = await state();
      const messages = c.content === undefined ? null : await posted("CONTENT_CHANGE");
      check(c.name, await c.ok(s), s.html);
      if (c.content === true)
        check(`${c.name}, the app is told`, messages.length === 1 && messages[0].data === s.html, JSON.stringify(messages));
      if (c.content === false) check(`${c.name}, the app isn't told`, !messages.length, JSON.stringify(messages));
      check(`${c.name}, boxes`, s.boxes, s.html);
      check(
        `${c.name}, the sanitizer keeps it`,
        (await sanitized(s.html)) === s.html,
        `${s.html}\n    ${await sanitized(s.html)}`
      );
      // undo once after the case's first press brings the start back
      const first = c.steps.findIndex(([kind]) => kind === "press" || kind === "rule");
      if (first < 0) continue;
      await open(c.start);
      for (const step of c.steps.slice(0, first + 1)) await run(step);
      await press("undo");
      const u = await state();
      check(`${c.name}, undo`, clean(u.html) === clean(c.start), `${c.start} -> ${u.html}`);
    }

    // The page's own changes share one undo with the browser's: typing after a change is undone first, then the change.
    const undoKey = async (shift = false) => {
      const zKey = {
        key: shift ? "Z" : "z",
        code: "KeyZ",
        windowsVirtualKeyCode: 90,
        modifiers: (mac ? 4 : 2) | (shift ? 8 : 0),
      };
      await driver.key(zKey);
      await sleep(90);
    };
    const made = `<ol class="x-todo"><li>${BOX}${A}</li></ol>`;
    await open(`<div>${A}</div>`);
    await select(end(A));
    await press("checkboxList");
    await type("x");
    check(
      "typing in a new checkbox line",
      html(await state()) === `<ol class="x-todo"><li>${BOX}${A}x</li></ol>`,
      (await state()).html
    );
    await press("undo");
    check("undo: the typing first", html(await state()) === made, (await state()).html);
    await press("undo");
    check("undo: then the checkbox list", html(await state()) === `<div>${A}</div>`, (await state()).html);
    await press("redo");
    check("redo: the checkbox list", html(await state()) === made, (await state()).html);
    await press("redo");
    check(
      "redo: then the typing",
      html(await state()) === `<ol class="x-todo"><li>${BOX}${A}x</li></ol>`,
      (await state()).html
    );

    await open(`<div>${A}</div>`);
    await select(end(A));
    await press("checkboxList");
    await undoKey();
    check(
      `${mac ? "Cmd" : "Ctrl"}+Z undoes the page's change`,
      html(await state()) === `<div>${A}</div>`,
      (await state()).html
    );
    await undoKey(true);
    check(`${mac ? "Shift+Cmd" : "Ctrl+Shift"}+Z redoes it`, html(await state()) === made, (await state()).html);

    await open(`<div>${A}</div>`);
    await select(end(A));
    await press("checkboxList");
    await clickBox(0);
    await press("undo");
    check(
      "a tick isn't an edit to undo: undo takes the list back",
      html(await state()) === `<div>${A}</div>`,
      (await state()).html
    );

    await open(`<div>${A}</div><div>${B}</div>`);
    await select({ caret: A, at: 2 });
    await run(["rule"]);
    await type("x");
    await press("undo");
    await press("undo");
    check(
      "a rule and what was typed after it, undone",
      html(await state()) === `<div>${A}</div><div>${B}</div>`,
      (await state()).html
    );
  }

  // 9. The bar's side of the page (spec B.1): the caret's state, posted when it changes, and the formatting commands by name.
  {
    const listenToState = () =>
      evaluate(`(() => {
      window.__state = [];
      window.addEventListener("message", (e) => {
        try { const m = JSON.parse(e.data); if (m.type === ${JSON.stringify(STATE_MESSAGE)} || m.type === ${JSON.stringify(TOUCH_MESSAGE)}) window.__state.push(m); } catch (error) {}
      });
    })()`);
    const states = async () => {
      await sleep(120);
      return evaluate(`window.__state.splice(0).filter((m) => m.type === ${JSON.stringify(STATE_MESSAGE)}).map((m) => m.data)`);
    };
    const touches = () =>
      evaluate(`window.__state.splice(0).filter((m) => m.type === ${JSON.stringify(TOUCH_MESSAGE)}).length`);
    const run = (command) => post({ type: "content", name: "command", data: formatCommand(command) });

    await open(`<div>plain one</div><div>x <b>bold</b> y</div>`);
    await listenToState();
    await select({ caret: "plain one", at: 2 });
    let got = await states();
    check(
      "the caret in a text line posts its state, once",
      got.length === 1 &&
        JSON.stringify(got[0]) ===
          JSON.stringify({
            line: "p",
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            sub: false,
            sup: false,
            center: false,
            code: false,
            highlight: false,
            link: false,
          }),
      JSON.stringify(got)
    );
    await select({ caret: "plain one", at: 4 });
    got = await states();
    check("moving inside the same line posts nothing more", !got.length, JSON.stringify(got));
    await select({ caret: "bold", at: 1 });
    got = await states();
    check("into bold text: bold", got.length === 1 && got[0].bold === true, JSON.stringify(got));

    await open(EVERY_LINE);
    await listenToState();
    let last = null;
    for (const [text, line] of [
      ["Testo semplice", "p"],
      ["Titolo uno", "h1"],
      ["Titolo due", "h2"],
      ["Una citazione", "quote"],
      ["codice()", "code"],
      ["punto", "ul"],
      ["numero", "ol"],
      ["da fare", "todo"],
      ["fatto", "todo"],
    ]) {
      await select({ caret: text, at: 1 });
      last = (await states()).pop() ?? last;
      check(`the caret in "${text}" posts line ${line}`, last?.line === line, JSON.stringify(last));
    }

    await open(`<div>plain one</div>`);
    await listenToState();
    await select({ text: "plain" });
    await states();
    await run("bold");
    got = await states();
    check(
      'run("bold") makes the selection bold and posts it',
      (await state()).html.includes("<b>plain</b>") && got.some((g) => g.bold === true),
      `${(await state()).html} ${JSON.stringify(got)}`
    );
    await run("justifyCenter");
    got = await states();
    check(
      'run("justifyCenter") posts center',
      got.some((g) => g.center === true),
      JSON.stringify(got)
    );
    const before = (await state()).html;
    await run("insertHTML");
    check('run("insertHTML") does nothing', (await state()).html === before, (await state()).html);

    await open(`<div>plain one</div><div>x <b>bold</b> y</div>`);
    await post({ type: "content", name: "setDisable", data: true });
    await listenToState();
    await select({ caret: "bold", at: 1 });
    await select({ text: "plain" });
    await run("bold");
    got = await states();
    check("a read-only note posts no state", !got.length, JSON.stringify(got));
    check('a read-only note: run("bold") changes nothing', !(await state()).html.includes("<b>plain"), (await state()).html);
    await post({ type: "content", name: "setDisable", data: false });

    await open(`<div>plain one</div>`);
    await listenToState();
    {
      const [tx, ty] = await evaluate(
        `(() => { const r = document.querySelector(".pell-content div").getBoundingClientRect(); return [r.x + 10, r.y + r.height / 2]; })()`
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: tx, y: ty, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: tx, y: ty, button: "left", clickCount: 1 });
      await sleep(120);
    }
    check("a pointerdown on the text posts a touch", (await touches()) >= 1, "no touch");
  }

  // 10. Links (spec B.3): made from the dialog's answer, edited whole, removed; a click never navigates, it asks the app.
  {
    const listen = () =>
      evaluate(`(() => {
      window.__links = [];
      window.addEventListener("message", (e) => {
        try { const m = JSON.parse(e.data); if (m.type === ${JSON.stringify(LINK_MESSAGE)} || m.type === ${JSON.stringify(LINK_START_MESSAGE)} || m.type === ${JSON.stringify(STATE_MESSAGE)}) window.__links.push(m); } catch (error) {}
      });
    })()`);
    const got = async (type) => {
      await sleep(150);
      return evaluate(`window.__links.splice(0).filter((m) => m.type === ${JSON.stringify(type)}).map((m) => m.data)`);
    };
    const cmd = (script) => post({ type: "content", name: "command", data: script });
    const blur = () =>
      evaluate(`(() => { document.querySelector(".pell-content").blur(); getSelection().removeAllRanges(); })()`);
    const sanitizedSame = async (name) => {
      const h = (await state()).html;
      check(`${name}, the sanitizer keeps it`, (await evaluate(`window.__fmSanitize(${JSON.stringify(h)})`)) === h, h);
    };

    await open("<div>alpha one</div>");
    await listen();
    await select({ text: "one" });
    await cmd(LINK_START_COMMAND);
    let answer = await got(LINK_START_MESSAGE);
    check(
      "linkStart answers the selected text",
      JSON.stringify(answer) === JSON.stringify([{ text: "one", href: null }]),
      JSON.stringify(answer)
    );
    await blur();
    await cmd(linkCommand("https://example.com", "one"));
    check(
      "link() writes the link on the remembered selection",
      (await state()).html === '<div>alpha <a href="https://example.com">one</a></div>',
      (await state()).html
    );
    await sanitizedSame("a link");
    await press("undo");
    check("undo takes the link away", (await state()).html === "<div>alpha one</div>", (await state()).html);

    await select({ text: "alpha" });
    await cmd(LINK_START_COMMAND);
    await blur();
    await cmd(LINK_CANCEL_COMMAND);
    check(
      "linkCancel puts the remembered selection back, focused",
      (await evaluate(
        `getSelection().toString() + "|" + (document.activeElement === document.querySelector(".pell-content"))`
      )) === "alpha|true",
      await evaluate(`getSelection().toString() + "|" + (document.activeElement === document.querySelector(".pell-content"))`)
    );
    await cmd(LINK_CANCEL_COMMAND);
    check("linkCancel twice changes nothing", (await state()).html === "<div>alpha one</div>", (await state()).html);

    await open('<div>alpha <a href="https://example.com">one</a></div>');
    await listen();
    await select({ caret: "one", at: 1 });
    let st = (await got(STATE_MESSAGE)).pop();
    check("the state says the caret is in a link", st?.link === true, JSON.stringify(st));
    check("a link's own underline doesn't light the underline control", st?.underline === false, JSON.stringify(st));
    await cmd(LINK_START_COMMAND);
    answer = await got(LINK_START_MESSAGE);
    check(
      "linkStart in a link answers its address and text",
      JSON.stringify(answer) === JSON.stringify([{ text: "one", href: "https://example.com" }]),
      JSON.stringify(answer)
    );
    await blur();
    await cmd(linkCommand("https://example.org", "uno"));
    check(
      "link() replaces the link whole",
      (await state()).html === '<div>alpha <a href="https://example.org">uno</a></div>',
      (await state()).html
    );
    await select({ caret: "uno", at: 1 });
    await cmd(UNLINK_COMMAND);
    check("unlink() keeps the text", (await state()).html === "<div>alpha uno</div>", (await state()).html);
    await press("undo");
    check(
      "undo brings the link back",
      (await state()).html === '<div>alpha <a href="https://example.org">uno</a></div>',
      (await state()).html
    );
    await press("undo");
    check(
      "undo again: the link as it was before its edit",
      (await state()).html === '<div>alpha <a href="https://example.com">one</a></div>',
      (await state()).html
    );

    await open("<div>alpha one</div>");
    await select(end("one"));
    await cmd(LINK_START_COMMAND);
    await cmd(linkCommand("https://example.com/?a=1&b=2", "x < y & z"));
    check(
      "a text with < and & is written escaped",
      (await state()).html === '<div>alpha one<a href="https://example.com/?a=1&amp;b=2">x &lt; y &amp; z</a></div>',
      (await state()).html
    );
    await sanitizedSame("an escaped link");

    await open("<pre>alpha one</pre>");
    await select({ text: "one" });
    await cmd(LINK_START_COMMAND);
    await cmd(linkCommand("https://example.com", "one"));
    check("no link in a code block", (await state()).html === "<pre>alpha one</pre>", (await state()).html);

    await open('<div>alpha <u><a href="https://example.com">one</a></u></div>');
    await listen();
    await select({ caret: "one", at: 1 });
    st = (await got(STATE_MESSAGE)).pop();
    check("an underlined link lights the underline control", st?.underline === true, JSON.stringify(st));

    const clickLink = async (modifiers = 0) => {
      const [lx, ly] = await evaluate(
        `(() => { const r = document.querySelector(".pell-content a").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: lx, y: ly, button: "left", clickCount: 1, modifiers });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: lx, y: ly, button: "left", clickCount: 1, modifiers });
      return got(LINK_MESSAGE);
    };
    await open('<div>alpha <a href="https://example.com">one</a></div>');
    await listen();
    const where = await evaluate("location.href");
    let clicked = await clickLink();
    check(
      "a click on a link asks the app, not direct",
      clicked.length === 1 &&
        clicked[0].href === "https://example.com" &&
        clicked[0].text === "one" &&
        clicked[0].editable === true &&
        clicked[0].direct === false,
      JSON.stringify(clicked)
    );
    check("the page doesn't navigate", (await evaluate("location.href")) === where, await evaluate("location.href"));
    clicked = await clickLink(mac ? 4 : 2);
    check("Ctrl/Cmd + click: direct", clicked.length === 1 && clicked[0].direct === true, JSON.stringify(clicked));
    await post({ type: "content", name: "setDisable", data: true });
    clicked = await clickLink();
    check(
      "in a read-only note: direct",
      clicked.length === 1 && clicked[0].direct === true && clicked[0].editable === false,
      JSON.stringify(clicked)
    );
    await post({ type: "content", name: "setDisable", data: false });
    await open('<div>alpha <a href="#fm-note-abc" contenteditable="false">Altra</a></div>');
    await listen();
    clicked = await clickLink();
    check("a note link posts no web link message", !clicked.length, JSON.stringify(clicked));
  }

  // 11. Links to another note (spec B.4): [[ opens the app's picker, the pick becomes a pill that is one character, a tap
  // on it asks the app to open the note.
  {
    const NOTE_A = '<a href="#fm-note-abc" contenteditable="false">Spesa</a>';
    const listen = () =>
      evaluate(`(() => {
      window.__picked = [];
      window.addEventListener("message", (e) => {
        try { const m = JSON.parse(e.data); if ([${JSON.stringify(PICKER_MESSAGE)}, ${JSON.stringify(PICKER_KEY_MESSAGE)}, ${JSON.stringify(NOTE_LINK_MESSAGE)}, ${JSON.stringify(LINK_MESSAGE)}].includes(m.type)) window.__picked.push(m); } catch (error) {}
      });
    })()`);
    const got = async () => {
      await sleep(150);
      return evaluate(`window.__picked.splice(0)`);
    };
    const last = (list, type) =>
      list
        .filter((m) => m.type === type)
        .map((m) => m.data)
        .pop();
    const cmd = (script) => post({ type: "content", name: "command", data: script });
    const caretText = () =>
      evaluate(
        `(() => { const s = getSelection(); return s.anchorNode.nodeType === 3 ? s.anchorNode.data.slice(0, s.anchorOffset) : "<" + s.anchorNode.nodeName + ">" + s.anchorOffset; })()`
      );
    const sanitizedSame = async (name) => {
      const h = (await state()).html;
      check(`${name}, the sanitizer keeps it`, (await evaluate(`window.__fmSanitize(${JSON.stringify(h)})`)) === h, h);
    };

    await open("<div>alpha</div>");
    await listen();
    await select(end("alpha"));
    await type("[[");
    let msgs = await got();
    check(
      "typing [[ opens the picker with nothing typed",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":true,"query":""}',
      JSON.stringify(msgs)
    );
    await type("s");
    await type("pe");
    msgs = await got();
    check(
      "what follows [[ is the query",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":true,"query":"spe"}',
      JSON.stringify(msgs)
    );
    await key("ArrowDown");
    msgs = await got();
    check("no rows shown: the arrow is the text's", !msgs.some((m) => m.type === PICKER_KEY_MESSAGE), JSON.stringify(msgs));
    await select(end("[[spe"));
    await cmd(pickerShownCommand(true));
    await key("ArrowDown");
    msgs = await got();
    check(
      "with the picker open, the down arrow goes to the app",
      last(msgs, PICKER_KEY_MESSAGE) === "down",
      JSON.stringify(msgs)
    );
    check("...and the caret doesn't move", (await caretText()) === "alpha[[spe", await caretText());
    await key("Enter");
    msgs = await got();
    check(
      "Enter goes to the app too, and adds no line",
      last(msgs, PICKER_KEY_MESSAGE) === "enter" && (await state()).html === "<div>alpha[[spe</div>",
      (await state()).html
    );
    await cmd(noteLinkCommand("abc", "Spesa"));
    check(
      "noteLink replaces [[ and the query with the link and a space",
      (await state()).html === `<div>alpha${NOTE_A}&nbsp;</div>`,
      (await state()).html
    );
    msgs = await got();
    check(
      "...and the picker closes",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":false,"query":""}',
      JSON.stringify(msgs)
    );
    await sanitizedSame("a note link");
    await type("x");
    check(
      "typing next to it goes outside it",
      (await state()).html === `<div>alpha${NOTE_A}&nbsp;x</div>`,
      (await state()).html
    );
    await press("undo");
    await press("undo");
    check("undo brings [[spe back", (await state()).html === "<div>alpha[[spe</div>", (await state()).html);

    await open(`<div>alpha ${NOTE_A} </div>`);
    await select({ after: "a" });
    await key("ArrowLeft");
    await sleep(100);
    const inside = await evaluate(`!!getSelection().anchorNode.parentElement.closest("a")`);
    check("the caret never stays inside the link", !inside, await caretText());
    await open(`<div>alpha ${NOTE_A} </div>`);
    await evaluate(
      `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c.firstChild.lastChild, 1); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
    );
    await key("Backspace");
    const afterBack = (await state()).html;
    check(
      "Backspace once after it and its space: no link, no stray text",
      !afterBack.includes("<a") &&
        !afterBack.includes("Spesa") &&
        afterBack.replace(/&nbsp;| |<br>/g, "") === "<div>alpha</div>",
      afterBack
    );

    // A note link is one thing: one Backspace right after it takes it, with the space put after it when picked.
    await open(`<div>alpha${NOTE_A}&nbsp;</div>`);
    await evaluate(
      `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c.firstChild.lastChild, 1); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
    );
    await key("Backspace");
    check(
      "Backspace right after a note link just picked removes it and its space",
      (await state()).html === "<div>alpha</div>",
      (await state()).html
    );
    await press("undo");
    check("...and undo brings both back", (await state()).html === `<div>alpha${NOTE_A}&nbsp;</div>`, (await state()).html);
    // Android's WebView leaves empty text nodes beside the link after a pick: they don't count.
    await open(`<div>alpha${NOTE_A}&nbsp;</div>`);
    await evaluate(
      `(() => { const c = document.querySelector(".pell-content"), d = c.firstChild, a = d.querySelector("a"); d.insertBefore(document.createTextNode(""), a.nextSibling); d.appendChild(document.createTextNode("")); c.focus(); const r = document.createRange(); r.setStart(d.childNodes[3], 1); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
    );
    await key("Backspace");
    check("...with empty text nodes beside it too", (await state()).html === "<div>alpha</div>", (await state()).html);
    await open(`<div>alpha${NOTE_A}&nbsp;</div>`);
    await evaluate(
      `(() => { const c = document.querySelector(".pell-content"), d = c.firstChild, t = document.createTextNode(""); d.appendChild(t); c.focus(); const r = document.createRange(); r.setStart(t, 0); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
    );
    await key("Backspace");
    check(
      "...and with the caret in an empty text node after its space (WebKit)",
      (await state()).html === "<div>alpha</div>",
      (await state()).html
    );
    await open(`<div>a${NOTE_A}bc</div>`);
    await select({ text: "bc", from: 0, to: 0 });
    await key("Backspace");
    check(
      "Backspace with the caret right after a note link removes it",
      (await state()).html === "<div>abc</div>",
      (await state()).html
    );
    await open(`<div>a${NOTE_A}bc</div>`);
    await select({ text: "a", from: 1, to: 1 });
    await key("Delete");
    check(
      "Delete with the caret right before a note link removes it",
      (await state()).html === "<div>abc</div>",
      (await state()).html
    );
    await open(`<div>a${NOTE_A}&nbsp;bc</div>`);
    await select({ text: "\u00a0bc", from: 1, to: 1 });
    await key("Backspace");
    check(
      "Backspace after the space of a note link followed by text takes only the space",
      (await state()).html === `<div>a${NOTE_A}bc</div>`,
      (await state()).html
    );

    await open("<div>alpha</div>");
    await listen();
    await select(end("alpha"));
    await type("[[sp");
    await got();
    await key("Backspace");
    await key("Backspace");
    await key("Backspace");
    msgs = await got();
    check(
      "deleting back past the brackets closes the picker",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":false,"query":""}',
      JSON.stringify(msgs)
    );
    await type("[[x");
    await got();
    await cmd(pickerShownCommand(true));
    await key("Escape");
    msgs = await got();
    check(
      "Esc closes it, and goes to the app",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":false,"query":""}' && last(msgs, PICKER_KEY_MESSAGE) === "escape",
      JSON.stringify(msgs)
    );
    await type("y");
    msgs = await got();
    check(
      "...and it stays closed while the same [[ is typed on",
      !msgs.some((m) => m.type === PICKER_MESSAGE && m.data.open),
      JSON.stringify(msgs)
    );
    await type(" [[");
    msgs = await got();
    check(
      "another [[ opens it again",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":true,"query":""}',
      JSON.stringify(msgs)
    );
    await cmd(pickerShownCommand(false));
    await key("Enter");
    msgs = await got();
    check(
      "open with no rows shown, Enter is the text's",
      !msgs.some((m) => m.type === PICKER_KEY_MESSAGE) && (await state()).html.includes("<br>"),
      (await state()).html
    );
    // back to the line before (Backspace: how much an undo takes back is the engine's)
    await key("Backspace");
    await select(end("y [["));
    await cmd(PICKER_CLOSE_COMMAND);
    msgs = await got();
    check(
      "closePicker closes it",
      JSON.stringify(last(msgs, PICKER_MESSAGE)) === '{"open":false,"query":""}',
      JSON.stringify(msgs)
    );

    await open("<pre>alpha </pre>");
    await listen();
    await select(end("alpha "));
    await type("[[");
    msgs = await got();
    check("[[ in a code block posts nothing", !msgs.some((m) => m.type === PICKER_MESSAGE), JSON.stringify(msgs));

    // From the bar's menu: the caret is remembered before the picker's field takes the focus.
    await open("<div>one two</div>");
    await select(end("one"));
    await cmd(PICK_START_COMMAND);
    await evaluate(`(() => { document.querySelector(".pell-content").blur(); getSelection().removeAllRanges(); })()`);
    await cmd(noteLinkCommand("abc", "Spesa"));
    check(
      "from the menu, the link goes where the caret was",
      (await state()).html === `<div>one${NOTE_A}&nbsp; two</div>`,
      (await state()).html
    );
    await select(end("two"));
    await cmd(PICK_START_COMMAND);
    await evaluate(`(() => { document.querySelector(".pell-content").blur(); getSelection().removeAllRanges(); })()`);
    await cmd(PICKER_CLOSE_COMMAND);
    check(
      "closed from the menu with no pick, the caret goes back",
      (await evaluate(
        `getSelection().anchorNode.data.slice(0, getSelection().anchorOffset) + "|" + (document.activeElement === document.querySelector(".pell-content"))`
      )) === " two|true",
      await evaluate(`getSelection().rangeCount && getSelection().anchorNode.nodeName`)
    );
    await cmd(noteLinkCommand("bad id!", "x"));
    check(
      "an id that isn't one does nothing",
      (await state()).html === `<div>one${NOTE_A}&nbsp; two</div>`,
      (await state()).html
    );

    // A line holding a note link changes kind whole (formatBlock stops at a contenteditable="false" element).
    await open(`<div>Un ${NOTE_A} qui</div>`);
    await select(end("qui"));
    await press("heading2");
    check(
      "a line with a note link becomes a heading whole",
      (await state()).html === `<h2>Un ${NOTE_A} qui</h2>`,
      (await state()).html
    );
    await press("heading2");
    check("...and text again", (await state()).html === `<div>Un ${NOTE_A} qui</div>`, (await state()).html);

    // Following it: in any note, editable or not, a click asks the app, never navigates, and is no web link.
    const clickNoteLink = async () => {
      const [lx, ly] = await evaluate(
        `(() => { const r = document.querySelector(".pell-content a").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: lx, y: ly, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: lx, y: ly, button: "left", clickCount: 1 });
      return got();
    };
    await open(`<div>alpha ${NOTE_A}</div>`);
    await listen();
    const where = await evaluate("location.href");
    msgs = await clickNoteLink();
    check(
      "a click on a note link asks the app to open the note",
      last(msgs, NOTE_LINK_MESSAGE) === "abc" && !msgs.some((m) => m.type === LINK_MESSAGE),
      JSON.stringify(msgs)
    );
    check("the page doesn't navigate", (await evaluate("location.href")) === where);
    await post({ type: "content", name: "setDisable", data: true });
    msgs = await clickNoteLink();
    check("...in a read-only note too", last(msgs, NOTE_LINK_MESSAGE) === "abc", JSON.stringify(msgs));
    await post({ type: "content", name: "setDisable", data: false });

    // What the sanitizer keeps of a note link, and what it takes from a link into the app.
    check(
      "a note link comes back from the sanitizer unchanged",
      (await evaluate(
        `window.__fmSanitize(${JSON.stringify(`<div><a href="#fm-note-abc123" contenteditable="false">Altra nota</a></div>`)})`
      )) === '<div><a href="#fm-note-abc123" contenteditable="false">Altra nota</a></div>'
    );
    for (const scheme of ["fastmemoapp", "fastmemoapptest"]) {
      const clean = await evaluate(`window.__fmSanitize(${JSON.stringify(`<a href="${scheme}://notes/abc">x</a>`)})`);
      check(`a ${scheme}:// link loses its address`, clean === "<a>x</a>", clean);
    }
  }

  // 12. Shortcuts while typing (spec B.5): a marker at the very start of a text line, then a space, makes the line that
  // kind; "---" then Enter makes a rule. Nowhere else, never from a paste or inside a composition.
  {
    const SHORT = [
      ["#", "<h1>x</h1>"],
      ["##", "<h2>x</h2>"],
      ["-", "<ul><li>x</li></ul>"],
      ["*", "<ul><li>x</li></ul>"],
      ["1.", "<ol><li>x</li></ol>"],
      ["[]", `<ol class="x-todo"><li>${BOX}x</li></ol>`],
      [">", "<blockquote>x</blockquote>"],
    ];
    const emptyLine = async (html = "<div><br></div>") => {
      await open(html);
      // as select() does: then a touchend, so pell saves the selection like after a tap
      await evaluate(
        `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c.firstChild, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); c.dispatchEvent(new Event("touchend", { bubbles: true })); })()`
      );
      await sleep(90);
    };
    for (const [action, expected] of [
      ["unorderedList", "<ul><li>x</li></ul>"],
      ["orderedList", "<ol><li>x</li></ol>"],
      ["checkboxList", `<ol class="x-todo"><li>${BOX}x</li></ol>`],
    ]) {
      await emptyLine();
      await press(action);
      await type("x");
      check(
        `the bar's ${action} on an empty line: the list isn't inside the line's <div>`,
        (await state()).html === expected,
        (await state()).html
      );
    }
    // An empty line under another one: the caret stays on it.
    const secondLine = async () => {
      await open("<div>prima</div><div><br></div>");
      await evaluate(
        `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c.lastChild, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); c.dispatchEvent(new Event("touchend", { bubbles: true })); })()`
      );
      await sleep(90);
    };
    for (const [how, run, expected] of [
      ["the bar's checkbox list", () => press("checkboxList"), `<div>prima</div><ol class="x-todo"><li>${BOX}x</li></ol>`],
      ["the bar's bullet list", () => press("unorderedList"), "<div>prima</div><ul><li>x</li></ul>"],
      [
        "[] and a space",
        async () => (await type("[]"), await type(" ")),
        `<div>prima</div><ol class="x-todo"><li>${BOX}x</li></ol>`,
      ],
      ["- and a space", async () => (await type("-"), await type(" ")), "<div>prima</div><ul><li>x</li></ul>"],
      ["# and a space", async () => (await type("#"), await type(" ")), "<div>prima</div><h1>x</h1>"],
    ]) {
      await secondLine();
      await run();
      await type("x");
      check(
        `${how} on an empty line under another: the caret stays on it`,
        (await state()).html === expected,
        (await state()).html
      );
    }
    for (const [marker, expected] of SHORT) {
      await emptyLine();
      await type(marker);
      await type(" ");
      await type("x");
      const html = (await state()).html;
      check(`"${marker} " at the start of a text line: ${expected}`, html === expected, html);
      const clean = await evaluate(`window.__fmSanitize(${JSON.stringify(html)})`);
      check(`"${marker} ": the sanitizer keeps it`, clean === html, clean);
      let back = html;
      const textOf = (h) =>
        h
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&gt;/g, ">");
      for (let i = 0; i < 6 && !textOf(back).startsWith(marker); i++) {
        await press("undo");
        back = (await state()).html;
      }
      check(
        `"${marker} ": undo gives the marker back as text, on a text line`,
        /^<div>/.test(back) && textOf(back).startsWith(marker),
        back
      );
    }

    // An empty note: the first character typed is bare text, and pell wraps it in a line with a setTimeout(0). On a page
    // just started (the Pixel after a cold start) that timer can fire after the marker's space and the next letter: held
    // here until then, and run in their order.
    for (const [marker, expected] of SHORT) {
      await open("");
      await evaluate(
        `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); c.dispatchEvent(new Event("touchend", { bubbles: true })); window.__held = []; window.__setTimeout = window.setTimeout; window.setTimeout = function (fn, ms) { if (ms) return window.__setTimeout.apply(window, arguments); var args = [].slice.call(arguments, 2); window.__held.push(function () { fn.apply(null, args); }); return 0; }; })()`
      );
      await type(marker);
      await type(" ");
      await type("x");
      await evaluate(
        `(() => { window.setTimeout = window.__setTimeout; const held = window.__held; window.__held = []; held.forEach((f) => f()); })()`
      );
      await sleep(90);
      const html = (await state()).html;
      check(`"${marker} " first in an empty note, pell's line wrap late: ${expected}`, html === expected, html);
    }

    // A web address typed, then a space or Enter: it becomes a link to itself (trailing punctuation stays text).
    const links = () =>
      evaluate(
        `JSON.stringify([...document.querySelectorAll(".pell-content a[href]")].map((a) => [a.getAttribute("href"), a.textContent]))`
      );
    for (const [typed, end, href, rest] of [
      ["vedi https://example.com/a?b=1", " ", "https://example.com/a?b=1", "vedi https://example.com/a?b=1 x"],
      ["vedi http://example.com.", " ", "http://example.com", "vedi http://example.com. x"],
      ["vedi https://example.com", "Enter", "https://example.com", "vedi https://example.comx"],
    ]) {
      await emptyLine();
      await type(typed);
      if (end === "Enter") await key("Enter");
      else await type(end);
      await type("x");
      const got = JSON.parse(await links());
      const text = (await state()).text.replace(/\u00a0/g, " ");
      check(
        `"${typed}" then ${end === " " ? "a space" : end}: a link to ${href}, and what follows is outside it`,
        got.length === 1 && got[0][0] === href && got[0][1] === href && text === rest,
        JSON.stringify(got) + " " + text
      );
    }
    await press("undo");
    await press("undo");
    check("undo gives the address back as text", JSON.parse(await links()).length === 0, await links());
    for (const [name, html, typed] of [
      ["in a code block", "<pre>x</pre>", "https://example.com "],
      ["the scheme alone", "<div><br></div>", "https://  "],
      ["inside a link", '<div><a href="https://a.it">see</a></div>', ""],
    ]) {
      await emptyLine(html);
      if (typed) await type(typed);
      else {
        await select(end("see"));
        await type(" https://b.it ");
      }
      const got = JSON.parse(await links());
      check(
        `no link made ${name}`,
        got.every((l) => l[0] !== "https://example.com" && l[0] !== "https://" && l[0] !== "https://b.it"),
        JSON.stringify(got)
      );
    }

    // Inline Markdown typed: the closing marker makes the text between bold, italic, struck or code. What is typed after
    // goes outside it (a zero-width space holds the caret there at the end of a line).
    const plain = (h) => h.replace(/​/g, "");
    for (const [typed, tag, inner] of [
      ["a **forte**", "b", "forte"],
      ["a *corsivo*", "i", "corsivo"],
      ["a _corsivo_", "i", "corsivo"],
      ["a ~~via~~", "strike", "via"],
      ["a __sotto__", "u", "sotto"],
      ["a ==evidenza==", "mark", "evidenza"],
      ["a `x = 1`", "code", "x = 1"],
    ]) {
      await emptyLine();
      await type(typed);
      await type("z");
      const html = plain((await state()).html);
      check(
        `"${typed}" typed: ${tag}, and what follows is outside it`,
        html === `<div>a <${tag}>${inner}</${tag}>z</div>`,
        html
      );
    }
    await emptyLine();
    await type("a **forte**");
    await press("undo");
    check(
      "undo gives the markers back",
      plain((await state()).html).replace(/&nbsp;/g, " ") === "<div>a **forte**</div>",
      (await state()).html
    );
    for (const [name, html, typed] of [
      ["a product", "<div><br></div>", "2*3*4 "],
      ["a name with underscores", "<div><br></div>", "snake_case_name "],
      ["a lone backtick", "<div><br></div>", "a ` b "],
      ["in a code block", "<pre>x</pre>", "`y` "],
    ]) {
      await emptyLine(html);
      await type(typed);
      const now = (await state()).html;
      check(`no inline style from ${name}`, !/<(b|i|strike|code)>/.test(now), now);
    }

    // Inline code from the bar's menu: the selection becomes code; with the caret in code, the code goes back to text.
    const command = (script) => post({ type: "content", name: "command", data: script });
    await open("<div>one two</div>");
    await select({ text: "two" });
    await command(formatCommand("code"));
    check(
      "the menu's inline code wraps the selection",
      plain((await state()).html) === "<div>one <code>two</code></div>",
      (await state()).html
    );
    await select({ text: "two", from: 1, to: 1 });
    await command(formatCommand("code"));
    check(
      "...and again, with the caret in it, takes it off",
      plain((await state()).html) === "<div>one two</div>",
      (await state()).html
    );

    // Highlight from the bar's menu, as inline code.
    await open("<div>one two</div>");
    await select({ text: "two" });
    await command(formatCommand("highlight"));
    check(
      "the menu's highlight wraps the selection",
      plain((await state()).html) === "<div>one <mark>two</mark></div>",
      (await state()).html
    );
    await select({ text: "two", from: 1, to: 1 });
    await command(formatCommand("highlight"));
    check(
      "...and again, with the caret in it, takes it off",
      plain((await state()).html) === "<div>one two</div>",
      (await state()).html
    );

    // "Normal": headings, quotes and code blocks become text lines and every inline style goes; links and boxes stay.
    await open(
      '<h1>T <b>b</b></h1><div>x <i>i</i> <code>c</code> <mark>m</mark> <u>u</u> <strike>s</strike> <a href="https://a.it">l</a></div><pre>p1<br>p2</pre>'
    );
    await evaluate(
      `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.selectNodeContents(c); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
    );
    await command(formatCommand("normal"));
    const normal = plain((await state()).html);
    check(
      '"Normal" on every line: text lines, no styles, the link kept',
      normal === '<div>T b</div><div>x i c m u s <a href="https://a.it">l</a></div><div>p1</div><div>p2</div>',
      normal
    );
    await press("undo");
    check(
      "...and one undo gives it all back",
      plain((await state()).html).startsWith("<h1>T <b>b</b></h1>"),
      (await state()).html
    );
    await open("<div><b>abcd</b></div><h2>keep <i>this</i></h2>");
    await select({ text: "abcd", from: 1, to: 3 });
    await command(formatCommand("normal"));
    check(
      '"Normal" on part of a line: only that part',
      plain((await state()).html) === "<div><b>a</b>bc<b>d</b></div><h2>keep <i>this</i></h2>",
      (await state()).html
    );
    await open(`<h2>a <i>b</i></h2><ol class="x-todo"><li>${BOX}<b>c</b></li></ol>`);
    await select({ text: "b", from: 0, to: 0 });
    await command(formatCommand("normal"));
    check(
      '"Normal" with the caret in a line: the whole line, and only it',
      plain((await state()).html) === `<div>a b</div><ol class="x-todo"><li>${BOX}<b>c</b></li></ol>`,
      (await state()).html
    );

    // Markdown pasted into a text note: its lines become the note's lines, its inline marks and links too, in one undo.
    const paste = async (text) => {
      await evaluate(
        `(() => { const dt = new DataTransfer(); dt.setData("text/plain", ${JSON.stringify(text)}); document.querySelector(".pell-content").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); })()`
      );
      await sleep(150);
    };
    await emptyLine();
    await paste("# Test titolo\n## Test sottotitolo\n[] uno\n[] due\n[x] tre\n---\n1. uno\n2. due\n3. tre\n**quattro**");
    const md = plain((await state()).html);
    check(
      "pasted Markdown becomes the note's lines",
      md ===
        `<h1>Test titolo</h1><h2>Test sottotitolo</h2><ol class="x-todo"><li>${BOX}uno</li><li>${BOX}due</li><li>${DONE}tre</li></ol><hr><ol><li>uno</li><li>due</li><li>tre</li></ol><div><b>quattro</b></div>`,
      md
    );
    check("...that the sanitizer keeps", (await evaluate(`window.__fmSanitize(${JSON.stringify(md)})`)) === md, "changed");
    await press("undo");
    check("...and one undo takes the paste away", plain((await state()).html) === "<div><br></div>", (await state()).html);
    await emptyLine();
    await paste(
      "- a\n* b\n> citazione\n```\nlet x = 1;\nx++;\n```\nvedi [qui](https://a.it) e https://b.it, `c`, _d_ ~~e~~ __f__ ==g=="
    );
    const md2 = plain((await state()).html);
    check(
      "lists, a quote, a code block, links and inline marks",
      md2 ===
        '<ul><li>a</li><li>b</li></ul><blockquote>citazione</blockquote><pre>let x = 1;<br>x++;</pre><div>vedi <a href="https://a.it">qui</a> e <a href="https://b.it">https://b.it</a>, <code>c</code>, <i>d</i> <strike>e</strike> <u>f</u> <mark>g</mark></div>',
      md2
    );
    await open("<div>abcd</div>");
    await select({ text: "abcd", from: 2, to: 2 });
    await paste("# T\n- x");
    const mid = plain((await state()).html);
    check(
      "pasted in the middle of a line: the line is split around it",
      mid === "<div>ab</div><h1>T</h1><ul><li>x</li></ul><div>cd</div>",
      mid
    );
    await open("<div>ab</div>");
    await select(end("ab"));
    await paste("**c** d");
    check(
      "Markdown of one line joins the line it is pasted in",
      plain((await state()).html) === "<div>ab<b>c</b> d</div>",
      (await state()).html
    );
    await emptyLine();
    await paste("just text\nand more");
    const pl = (await state()).html;
    check("text with no Markdown is pasted as it was", !/<(h1|h2|ul|ol|b|i|code|a)\b/.test(pl) && pl.includes("just text"), pl);
    await emptyLine("<pre>x</pre>");
    await paste("# not a heading");
    check("nothing is converted in a code block", !(await state()).html.includes("<h1>"), (await state()).html);

    // Gboard's clipboard chip puts the copied text in as typing: one insertText holding every line, no paste event.
    const insertLines = (text) =>
      evaluate(
        `(() => { const e = new InputEvent("beforeinput", { inputType: "insertText", data: ${JSON.stringify(text)}, bubbles: true, cancelable: true }); document.querySelector(".pell-content").dispatchEvent(e); return e.defaultPrevented; })()`
      );
    await emptyLine();
    const chipTaken = await insertLines("# T\n- x");
    check(
      "Markdown put in by the keyboard's clipboard is converted like a paste",
      chipTaken && plain((await state()).html) === "<h1>T</h1><ul><li>x</li></ul>",
      (await state()).html
    );
    await emptyLine();
    check("...lines with no Markdown are left to the browser", !(await insertLines("just text\nand more")));
    await emptyLine();
    check("...and one line typed is never taken for a paste", !(await insertLines("# T")));

    await emptyLine();
    await type("a #");
    await type(" ");
    check(
      "a marker after other text changes nothing",
      (await state()).html.replace(/&nbsp;/g, " ") === "<div>a # </div>",
      (await state()).html
    );

    for (const [name, html, at] of [
      ["a heading", "<h1>t</h1>", "h1"],
      ["a list item", "<ul><li>t</li></ul>", "li"],
      ["a quote", "<blockquote>t</blockquote>", "blockquote"],
      ["a code block", "<pre>t</pre>", "pre"],
    ]) {
      await open(html);
      await evaluate(
        `(() => { const c = document.querySelector(".pell-content"); c.focus(); const r = document.createRange(); r.setStart(c.querySelector(${JSON.stringify(at)}).firstChild, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); })()`
      );
      await type("#");
      await type(" ");
      const now = (await state()).html.replace(/&nbsp;/g, " ");
      check(`"# " at the start of ${name} changes nothing`, now.includes("# t"), now);
    }

    await emptyLine();
    await type("---");
    await key("Enter");
    await type("x");
    check(
      '"---" then Enter: a rule and a text line after it',
      (await state()).html === "<hr><div>x</div>",
      (await state()).html
    );
    await emptyLine();
    await type("--");
    await key("Enter");
    check(
      '"--" then Enter: the two characters and a new line',
      (await state()).html === "<div>--</div><div><br></div>",
      (await state()).html
    );

    if (!driver.can.compose) skipped.push("a marker typed inside a composition");
    else {
      await emptyLine();
      await driver.compose("#");
      await sleep(50);
      await driver.type("# ");
      await sleep(90);
      await type("x");
      check(
        "a marker typed inside a composition changes nothing",
        !(await state()).html.includes("<h1>"),
        (await state()).html
      );
    }

    await emptyLine();
    await evaluate(
      `(() => { const dt = new DataTransfer(); dt.setData("text/plain", "# "); document.querySelector(".pell-content").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); })()`
    );
    await sleep(150);
    check("a pasted marker changes nothing", !(await state()).html.includes("<h1>"), (await state()).html);
  }

  // 13. Pictures pasted or dropped (spec C.3): the page posts them to the app (FASTMEMO_IMAGE_IN, data URLs in order), which
  // reduces and inserts them. Text on the clipboard wins; other files, and a read-only note, take nothing.
  {
    // A paste or a drop of `files` ({ name, type, data: a data URL } or { name, type, text }), plus plain `text`; a drop at
    // (x, y). Answers whether the event was cancelled.
    const fileEvent = (kind, files, { text, x = 0, y = 0 } = {}) =>
      evaluate(`(() => {
      const bytes = (d) => { const b = atob(d.split(",")[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
      const dt = new DataTransfer();
      for (const f of ${JSON.stringify(files)}) dt.items.add(new File([f.data ? bytes(f.data) : f.text], f.name, { type: f.type }));
      ${text === undefined ? "" : `dt.setData("text/plain", ${JSON.stringify(text)});`}
      const c = document.querySelector(".pell-content");
      const e = ${JSON.stringify(kind)} === "paste"
        ? new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
        : new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: ${x}, clientY: ${y} });
      (${JSON.stringify(kind)} === "paste" ? c : document.elementFromPoint(${x}, ${y}) || c).dispatchEvent(e);
      return e.defaultPrevented;
    })()`);
    const IMAGE_IN = "FASTMEMO_IMAGE_IN";
    const png = { name: "a.png", type: "image/png", data: PNG };
    const jpeg = { name: "b.jpg", type: "image/jpeg", data: JPEG };

    await open("<div>first line</div><div>second line</div>");
    await listenToPage();
    await select({ caret: "first", at: 5 });
    const before = (await state()).html;
    const pasteTaken = await fileEvent("paste", [png]);
    let sent = await posted(IMAGE_IN);
    check(
      "a picture pasted is posted to the app as a data URL",
      sent.length === 1 && sent[0].data.images.length === 1 && sent[0].data.images[0].startsWith("data:image/png;base64,"),
      JSON.stringify(sent).slice(0, 200)
    );
    check(
      "...the paste is cancelled and the note is unchanged",
      pasteTaken && (await state()).html === before,
      (await state()).html
    );

    await fileEvent("paste", [png], { text: "**b**" });
    sent = await posted(IMAGE_IN);
    check("with text on the clipboard the text is pasted", (await state()).html.includes("<b>b</b>"), (await state()).html);
    check("...and no picture is posted", !sent.length, JSON.stringify(sent).slice(0, 200));

    await open("<div>first line</div><div>second line</div>");
    await listenToPage();
    // The left edge of "line" in the second line, one pixel in: the caret goes before it.
    const [dx, dy] = await evaluate(`(() => {
      const t = document.querySelectorAll(".pell-content div")[1].firstChild, r = document.createRange();
      r.setStart(t, 7); r.setEnd(t, 8);
      const b = r.getBoundingClientRect();
      return [b.left + 1, b.top + b.height / 2];
    })()`);
    await fileEvent("drop", [png, jpeg], { x: dx, y: dy });
    sent = await posted(IMAGE_IN);
    check(
      "two pictures dropped are posted in order",
      sent.length === 1 &&
        sent[0].data.images.length === 2 &&
        sent[0].data.images[0].startsWith("data:image/png;") &&
        sent[0].data.images[1].startsWith("data:image/jpeg;"),
      JSON.stringify(sent).slice(0, 200)
    );
    const caret = await evaluate(
      `(() => { const s = getSelection(); return [s.anchorNode && s.anchorNode.data, s.anchorOffset]; })()`
    );
    check("...and the caret is where they were dropped", caret[0] === "second line" && caret[1] === 7, JSON.stringify(caret));
    // What the app does next (insertImageFrom): focusContentEditor, which puts back the caret pell kept, then the picture.
    await sleep(100);
    await insertImage(PNG);
    const placed = (await state()).html.replace(/src="[^"]*"/g, "src");
    check("...and the app puts the pictures there", /second <img src[ >]/.test(placed.replace(/&nbsp;/g, " ")), placed);

    const unchanged = (await state()).html;
    const pdfTaken = await fileEvent("drop", [{ name: "c.pdf", type: "application/pdf", text: "%PDF-1.4" }], { x: dx, y: dy });
    sent = await posted(IMAGE_IN);
    check("a PDF dropped posts nothing", !sent.length, JSON.stringify(sent).slice(0, 200));
    check("...changes nothing, and nothing opens it", pdfTaken && (await state()).html === unchanged, (await state()).html);

    await post({ type: "content", name: "setDisable", data: true });
    await fileEvent("paste", [png]);
    await fileEvent("drop", [png], { x: dx, y: dy });
    sent = await posted(IMAGE_IN);
    check("a read-only note takes no picture", !sent.length, JSON.stringify(sent).slice(0, 200));
  }

  // Esc closes the app's find bar (Task 30): while the bar is open the page posts Esc to the app and keeps it from the
  // page's other keys; with the bar closed Esc is the page's. Back to the note, the caret is where it was when the bar
  // opened, whatever the search did to the selection.
  {
    const find = (call) => evaluate(`window[${JSON.stringify(FIND_PAGE)}].${call}`);
    await open("<div>uno due tre</div>");
    await evaluate(`(() => {
      window.__escapes = 0;
      window.addEventListener("message", (e) => {
        try { if (JSON.parse(e.data).type === ${JSON.stringify(FIND_ESCAPE_MESSAGE)}) window.__escapes++; } catch (error) {}
      });
    })()`);
    await select({ caret: "due", at: 1 });
    await key("Escape");
    check("Esc with the find bar closed posts nothing", (await evaluate("window.__escapes")) === 0);
    await find("open(true)");
    await key("Escape");
    await sleep(60);
    check("Esc with the find bar open goes to the app", (await evaluate("window.__escapes")) === 1);
    // the search: the selection on a match, then cleared, the page left
    await select({ text: "tre" });
    await evaluate(`(() => { getSelection().removeAllRanges(); document.querySelector(".pell-content").blur(); })()`);
    await find("back()");
    await sleep(120);
    const back = await evaluate(
      `(() => { const s = getSelection(); return (document.activeElement === document.querySelector(".pell-content")) + " " + (s.anchorNode && s.anchorNode.nodeType === 3 ? s.anchorNode.data.slice(0, s.anchorOffset) : "none") + " " + s.isCollapsed; })()`
    );
    check("back to the note: focused, the caret where it was", back === "true uno d true", back);
    await type("X");
    check("typing goes on there", (await state()).html === "<div>uno dXue tre</div>", (await state()).html);
    // the caret moved in the note while the bar was open: Esc there keeps it where it now is
    await find("open(true)");
    await select({ caret: "tre", at: 2 });
    await key("Escape");
    await evaluate(`getSelection().removeAllRanges()`);
    await find("back()");
    await sleep(120);
    const moved = await evaluate(
      `(() => { const s = getSelection(); return s.anchorNode && s.anchorNode.nodeType === 3 ? s.anchorNode.data.slice(0, s.anchorOffset) : "none"; })()`
    );
    check("Esc in the note: the caret stays where it was put", moved === "uno dXue tr", moved);
    // in the note with a match still selected (a first click that only gave it the focus): a caret at its end
    await select({ text: "dXue" });
    await key("Escape");
    await evaluate(`getSelection().removeAllRanges()`);
    await find("back()");
    await sleep(120);
    const matchEnd = await evaluate(
      `(() => { const s = getSelection(); return s.isCollapsed + " " + (s.anchorNode && s.anchorNode.nodeType === 3 ? s.anchorNode.data.slice(0, s.anchorOffset) : "none"); })()`
    );
    check("Esc on a selected match: the caret at its end", matchEnd === "true uno dXue", matchEnd);
    await find("open(false)");
    await select({ caret: "dXue", at: 1 });
    await key("Escape");
    await sleep(60);
    check("Esc after the bar closed posts nothing again", (await evaluate("window.__escapes")) === 3);
    await find("open(true)");
    await evaluate(`(() => { getSelection().removeAllRanges(); document.querySelector(".pell-content").blur(); })()`);
    await post({ type: "content", name: "setHtml", data: "<div>altro</div>" });
    await find("back()");
    await sleep(120);
    const end = await evaluate(
      `(() => { const s = getSelection(); return s.anchorNode && s.anchorNode.nodeType === 3 ? s.anchorNode.data.slice(0, s.anchorOffset) : "none " + (s.anchorNode && s.anchorNode.nodeName) + s.anchorOffset + " " + document.querySelector(".pell-content").innerHTML; })()`
    );
    check("the text it was in is gone: the caret at the end", end === "altro", end);
  }

  check(
    "the note sanitizer keeps every new line",
    (await evaluate(`window.__fmSanitize(${JSON.stringify(EVERY_LINE)})`)) === EVERY_LINE
  );
  check("the note sanitizer was in the page", await evaluate("typeof window.__fmSanitize === 'function'"), "missing");
  await driver.flushErrors?.();
  check("no page errors", !pageErrors.length, pageErrors.join("\n"));

  return { passed, failures, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const page = await buildPage();
  const driver = await chromeDriver();
  let result;
  try {
    result = await runCases(driver, page, page.url);
  } finally {
    await driver.close();
    page.dispose();
  }
  console.log(`${result.passed} passed, ${result.failures.length} failed`);
  for (const f of result.failures) console.log("✗ " + f);
  process.exit(result.failures.length ? 1 : 0);
}
