// The text editor's page for the tests, and the browsers that drive it.
// buildPage(srcRoot): the real pell page (createHTML with the app's options and CSS) and the page's scripts, built from the
// sources under srcRoot (this tree, or a worktree at a released tag), with this tree's node_modules.
// chromeDriver(): headless Chrome over the DevTools protocol. safariDriver(): Safari over WebDriver (safaridriver ships
// with macOS), or null when Safari's remote automation is off. Both have the same methods; what only Chrome's protocol
// can do (touches, a composition) throws `Unsupported` in Safari.

import { build } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** What a browser can't do through its driver. */
export class Unsupported extends Error {}

/**
 * Builds the editor page from the sources under `srcRoot`. `scripts` holds that tree's exports of
 * `src/libs/richTextEditor.ts` and its `EDITOR_SANITIZE_JS`, plus `PAGE_ERROR_SCRIPT`/`PAGE_ERROR_MESSAGE` and
 * `getTextLength` only when the tree has them (plan 1 added them: a released page is tested without).
 */
export async function buildPage(srcRoot = root) {
  const tmp = mkdtempSync(join(os.tmpdir(), "richtext-page-"));
  const src = join(srcRoot, "src");
  const has = (file, text) => existsSync(join(src, file)) && readFileSync(join(src, file), "utf8").includes(text);
  const entry = join(tmp, "entry.mjs");
  writeFileSync(
    entry,
    [
      `export * from ${JSON.stringify(join(src, "libs/richTextEditor.ts"))};`,
      `export { EDITOR_SANITIZE_JS } from ${JSON.stringify(join(src, "generated/editor-sanitize.ts"))};`,
      `export { createHTML } from ${JSON.stringify(join(root, "node_modules/react-native-pell-rich-editor/src/editor.js"))};`,
      has("utils/string.ts", "export const getTextLength")
        ? `export { getTextLength } from ${JSON.stringify(join(src, "utils/string.ts"))};`
        : "",
      has("libs/pageErrors.ts", "PAGE_ERROR_SCRIPT")
        ? `export { PAGE_ERROR_SCRIPT, PAGE_ERROR_MESSAGE } from ${JSON.stringify(join(src, "libs/pageErrors.ts"))};`
        : "",
    ].join("\n")
  );
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: join(tmp, "page.bundle.mjs"),
    alias: { "@": src },
    // a worktree has no node_modules of its own
    nodePaths: [join(root, "node_modules")],
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
  const scripts = await import(pathToFileURL(join(tmp, "page.bundle.mjs")).href);
  const file = join(tmp, "page.html");
  // RichEditor's props in NoteTextEditor
  writeFileSync(file, scripts.createHTML({ ...scripts.RICH_TEXT_STYLE, useContainer: false, pasteAsPlainText: true }));
  let server = null;
  return {
    url: pathToFileURL(file).href,
    scripts,
    /** The page served from 127.0.0.1 (Safari over WebDriver doesn't open file: pages). */
    async serve() {
      if (!server) {
        server = createServer((_req, res) => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(readFileSync(file));
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      }
      return `http://127.0.0.1:${server.address().port}/page.html`;
    },
    dispose() {
      server?.close();
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** Headless Chrome over the DevTools protocol (CHROME=/path/to/chrome to use another one). */
export async function chromeDriver() {
  const CHROME =
    process.env.CHROME ||
    ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
      existsSync
    );
  if (!CHROME) throw new Error("Google Chrome not found: set CHROME=/path/to/chrome");
  const profile = mkdtempSync(join(os.tmpdir(), "richtext-chrome-"));
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
  await send("Page.enable");
  await send("Runtime.enable");
  return {
    name: "Chrome",
    can: { touch: true, compose: true },
    pageErrors,
    /** The protocol itself, for what only Chrome does. */
    send,
    async goto(url) {
      const loaded = new Promise((resolve) => waiters.push({ method: "Page.loadEventFired", resolve }));
      await send("Page.navigate", { url });
      await loaded;
    },
    async evaluate(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
      return r.result.result.value;
    },
    /** A key as the DevTools protocol describes it: { key, code, windowsVirtualKeyCode, text?, commands?, modifiers? }. */
    async key(spec) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...spec });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: spec.key, code: spec.code, modifiers: spec.modifiers ?? 0 });
    },
    async type(text) {
      await send("Input.insertText", { text });
    },
    /** A mouse event as the DevTools protocol describes it (modifiers: Alt 1, Ctrl 2, Meta 4, Shift 8). */
    async mouse(event) {
      await send("Input.dispatchMouseEvent", event);
    },
    async touch(event) {
      await send("Input.dispatchTouchEvent", event);
    },
    async touchEmulation(enabled) {
      await send("Emulation.setTouchEmulationEnabled", enabled ? { enabled, maxTouchPoints: 1 } : { enabled });
    },
    async compose(text) {
      await send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
    },
    async close() {
      ws.close();
      // Chrome writes its profile until it has exited
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await exited;
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

// WebDriver's names of the keys the tests press.
const WD_KEYS = {
  Enter: "",
  Backspace: "",
  Escape: "",
  ArrowLeft: "",
  ArrowUp: "",
  ArrowRight: "",
  ArrowDown: "",
  Shift: "",
  Control: "",
  Alt: "",
  Meta: "",
};
const MODIFIERS = [
  [1, "Alt"],
  [2, "Control"],
  [4, "Meta"],
  [8, "Shift"],
];
const held = (mask = 0) => MODIFIERS.filter(([bit]) => mask & bit).map(([, name]) => WD_KEYS[name]);

/** Safari over WebDriver, or null when its remote automation is off (Safari → Develop → Allow Remote Automation). */
export async function safariDriver() {
  const port = 4440 + Math.floor(Math.random() * 500);
  const driver = spawn("/usr/bin/safaridriver", ["-p", String(port)], { stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  let session = null;
  for (let i = 0; i < 50 && !session; i++) {
    await sleep(100);
    try {
      const r = await fetch(`${base}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capabilities: { alwaysMatch: { browserName: "safari" } } }),
      });
      const body = await r.json();
      if (body.value?.sessionId) session = body.value.sessionId;
      else if (body.value?.error) break;
    } catch {
      // not listening yet
    }
  }
  if (!session) {
    driver.kill();
    return null;
  }
  const call = async (method, path, body) => {
    const r = await fetch(`${base}/session/${session}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await r.json();
    if (json.value?.error) throw new Error(`${json.value.error}: ${json.value.message}`);
    return json.value;
  };
  const pageErrors = [];
  // Errors are kept by the page itself, and read before each navigation and at the end.
  const collectErrors = async () => {
    try {
      const errors = await call("POST", "/execute/sync", { script: "return (window.__testErrors || []).splice(0);", args: [] });
      pageErrors.push(...errors);
    } catch {
      // no page yet
    }
  };
  const actions = (list) => call("POST", "/actions", { actions: list });
  const keys = (sequence) => actions([{ type: "key", id: "keyboard", actions: sequence }]);
  let modifiersDown = [];
  return {
    name: "Safari",
    can: { touch: false, compose: false },
    pageErrors,
    // the page's errors so far into pageErrors (they are read at each navigation, and here)
    flushErrors: collectErrors,
    async goto(url) {
      await collectErrors();
      await call("POST", "/url", { url });
      await call("POST", "/execute/sync", {
        script: `window.__testErrors = []; window.addEventListener("error", (e) => window.__testErrors.push(String(e.message)));
          window.addEventListener("unhandledrejection", (e) => window.__testErrors.push(String(e.reason))); return 1;`,
        args: [],
      });
    },
    async evaluate(expression) {
      const result = await call("POST", "/execute/async", {
        script: `const done = arguments[arguments.length - 1];
          try { Promise.resolve((0, eval)(arguments[0])).then((v) => done({ v: JSON.stringify(v === undefined ? null : v) }), (e) => done({ e: String(e) + ' ' + String((e && e.stack) || '') })); }
          catch (e) { done({ e: String(e) + ' ' + String((e && e.stack) || '') }); }`,
        args: [expression],
      });
      if (result && "e" in result) throw new Error(result.e);
      // as JSON text from the page: WebDriver's own objects don't keep the order of the keys, which the cases compare
      const value = JSON.parse(result.v);
      return value === null ? undefined : value;
    },
    async key(spec) {
      const name = WD_KEYS[spec.key] ?? spec.key;
      const mods = held(spec.modifiers);
      await keys([
        ...mods.map((value) => ({ type: "keyDown", value })),
        { type: "keyDown", value: name },
        { type: "keyUp", value: name },
        ...mods.reverse().map((value) => ({ type: "keyUp", value })),
      ]);
    },
    async type(text) {
      await keys(
        [...text].flatMap((value) => [
          { type: "keyDown", value },
          { type: "keyUp", value },
        ])
      );
    },
    async mouse({ type, x, y, modifiers }) {
      const move = { type: "pointerMove", origin: "viewport", x: Math.round(x), y: Math.round(y), duration: 0 };
      const pointer = (list) => ({ type: "pointer", id: "mouse", parameters: { pointerType: "mouse" }, actions: list });
      if (type === "mouseMoved") return actions([pointer([move])]);
      if (type === "mousePressed") {
        modifiersDown = held(modifiers);
        const list = [pointer([move, { type: "pointerDown", button: 0 }])];
        if (modifiersDown.length)
          list.unshift({ type: "key", id: "keyboard", actions: modifiersDown.map((value) => ({ type: "keyDown", value })) });
        return actions(list);
      }
      await actions([pointer([move, { type: "pointerUp", button: 0 }])]);
      if (modifiersDown.length) await keys(modifiersDown.map((value) => ({ type: "keyUp", value })));
      modifiersDown = [];
    },
    async touch() {
      throw new Unsupported("touch events");
    },
    async touchEmulation() {
      throw new Unsupported("touch emulation");
    },
    async compose() {
      throw new Unsupported("a composition");
    },
    async close() {
      await collectErrors();
      try {
        await fetch(`${base}/session/${session}`, { method: "DELETE" });
      } catch {
        // already gone
      }
      driver.kill();
    },
  };
}
