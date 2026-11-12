// Code note page test: the page `buildCodeEditorHtml` builds must hold the note's code exactly, whatever it contains
// ("$'", "$&", "</script>", "<!--", U+2028, half a megabyte...), and nothing of the code may become part of the page (LL-077).
// Node cases on the built string, the languages offered against the page's highlighters (LL-086), then the real page in
// headless Chrome.
// Run: node scripts/code-page.test.mjs   (needs Google Chrome; CHROME=/path/to/chrome to use another one)

import { build } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
const CHROME =
  process.env.CHROME ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
    existsSync
  );

const tmp = mkdtempSync(join(os.tmpdir(), "code-page-"));
const out = join(tmp, "page.bundle.mjs");
await build({
  stdin: {
    contents: `
      export * from "@/libs/codeEditorPage";
      export { CODEMIRROR_HTML } from "@/generated/codemirror-html";
      export { SCROLLBAR_CSS } from "@/styles/scrollbar";
      export { PAGE_ERROR_SCRIPT } from "@/libs/pageErrors";
      export { CODE_LANGUAGES, PLAIN_TEXT_LANGUAGES } from "@/constants/code-languages";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": src },
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
});
const {
  buildCodeEditorHtml,
  buildPageFrom,
  serializeForScript,
  CODEMIRROR_HTML,
  SCROLLBAR_CSS,
  PAGE_ERROR_SCRIPT,
  CODE_LANGUAGES,
  PLAIN_TEXT_LANGUAGES,
} = await import(pathToFileURL(out).href);

let passed = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else failures.push(`${name}${detail !== undefined ? `: ${String(detail).slice(0, 300)}` : ""}`);
};
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* The built string                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

const NEEDLE = "window.__EDITOR_CONFIG__=window.__EDITOR_CONFIG__||{};";
const CODES = [
  "price = cost * 2",
  "re.sub(r'^\\d+$', '', s)",
  "echo $$",
  "s.replace(/x/g, '\\\\$&')",
  "a = '$' + \"'\"",
  "x = `$``",
  'const page = "</script><b id=fromTheTab>hello</b>";',
  "<!-- <script>",
  "a]]>b",
  "line1\u2028line2\u2029end",
  "",
  "é".repeat(250_000),
];
for (const code of CODES) {
  const label = JSON.stringify(code.slice(0, 30));
  const config = { code, language: "javascript", readOnly: false };
  const html = buildCodeEditorHtml(config);
  const script = `window.__EDITOR_CONFIG__=${serializeForScript(config)};${PAGE_ERROR_SCRIPT}`;
  ok(
    `the page grows by exactly what was put in ${label}`,
    html.length === CODEMIRROR_HTML.length - NEEDLE.length + script.length + `<style>${SCROLLBAR_CSS}</style>`.length,
    html.length
  );
  const start = html.indexOf("window.__EDITOR_CONFIG__=");
  const body = html.slice(start, html.indexOf("</script>", start));
  ok(`the script ends where the app ended it ${label}`, body === script);
  const win = { addEventListener() {} };
  let error = null;
  try {
    new Function("window", body)(win);
  } catch (e) {
    error = e;
  }
  ok(`the code comes back unchanged ${label}`, !error && win.__EDITOR_CONFIG__?.code === code, error ?? "");
}
ok(
  "a page without the placeholder is refused",
  throws(() => buildPageFrom("<html></html>", { code: "", language: "javascript", readOnly: false }))
);
ok(
  "nothing in the serialized config can close a script or open a comment",
  !/[<>&\u2028\u2029]/.test(serializeForScript({ code: "</script><!-- & \u2028\u2029" }))
);
ok(
  "read-only and language are carried",
  (() => {
    const html = buildCodeEditorHtml({ code: "x", language: "python", readOnly: true });
    const start = html.indexOf("window.__EDITOR_CONFIG__=");
    const win = { addEventListener() {} };
    new Function("window", html.slice(start, html.indexOf("</script>", start)))(win);
    return win.__EDITOR_CONFIG__.language === "python" && win.__EDITOR_CONFIG__.readOnly === true;
  })()
);

/* ------------------------------------------------------------------------------------------------------------------ */
/* The languages offered and the page's highlighters (LL-086)                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

// A language the picker offers either has a loader in the page or is marked as plain text there, never both.
{
  const entry = readFileSync(join(src, "editor", "codemirror-entry.js"), "utf8");
  const loaders = new Set([...entry.matchAll(/^\s{2}(\w+): \(\) => import/gm)].map((m) => m[1]));
  ok("the page's loaders are found", loaders.size > 10, loaders.size);
  for (const lang of CODE_LANGUAGES) {
    if (lang === "plaintext") continue;
    ok(`${lang}: highlighted, or said to be plain text`, loaders.has(lang) !== !!PLAIN_TEXT_LANGUAGES?.has(lang));
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The real page in headless Chrome                                                                                   */
/* ------------------------------------------------------------------------------------------------------------------ */

if (!CHROME) {
  console.log("Google Chrome not found: set CHROME=/path/to/chrome");
  process.exit(1);
}

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
// The app's side of the WebView bridge, there before the page's own scripts.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: "window.__messages = []; window.ReactNativeWebView = { postMessage: (m) => window.__messages.push(m) };",
});

/** Loads the page built for `code` and waits for the editor's "ready". */
const openCode = async (code, language = "javascript") => {
  const file = join(tmp, `page-${Date.now()}.html`);
  writeFileSync(file, buildCodeEditorHtml({ code, language, readOnly: false }));
  const loaded = new Promise((resolve) => waiters.push({ method: "Page.loadEventFired", resolve }));
  await send("Page.navigate", { url: pathToFileURL(file).href });
  await loaded;
  for (let i = 0; i < 50; i++) {
    const ready = await evaluate(
      `window.__messages.some((m) => { try { return JSON.parse(m).type === "ready"; } catch { return false; } })`
    );
    if (ready) return true;
    await sleep(50);
  }
  return false;
};
/** The editor's text as it shows it. */
const shownText = () => evaluate(`[...document.querySelectorAll(".cm-line")].map((l) => l.textContent).join("\\n")`);

{
  const code = 'const page = "</script><b id=fromTheTab>hello</b>";\nconst cost = "$\'" + "$&";';
  const ready = await openCode(code);
  ok("the page loads and says ready", ready);
  ok(
    "no markup of the tab became part of the page",
    (await evaluate(`document.getElementById("fromTheTab") === null`)) === true
  );
  ok("the editor shows exactly the code", (await shownText()) === code, await shownText());
  ok("no exception in the page", pageErrors.length === 0, pageErrors.join("\n"));
}

// When the page sends the text: once typing pauses (50 ms), at the latest 250 ms after the first change not yet sent,
// and at once when the editor is left, the page is hidden or the app asks for it (a flush).
{
  /** The `change` messages the page sent, oldest first. */
  const changes = async () =>
    JSON.parse(await evaluate(`JSON.stringify(window.__messages)`))
      .map((m) => JSON.parse(m))
      .filter((m) => m.type === "change");
  /** Real key events on the editor, one character at a time. */
  const typeKeys = async (text, { gapMs = 0 } = {}) => {
    await evaluate(`document.querySelector(".cm-content").focus()`);
    for (const ch of text) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      if (gapMs) await sleep(gapMs);
    }
  };
  /** Lets any pending send go out, then forgets every message. */
  const reset = async () => {
    await sleep(400);
    await evaluate(`window.__messages = []`);
  };
  const handle = (msg) => evaluate(`window.handleMessage(${JSON.stringify(JSON.stringify(msg))})`);

  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await openCode("");
  await reset();
  await typeKeys("abc", { gapMs: 10 });
  ok("nothing is sent while typing", (await changes()).length === 0, JSON.stringify(await changes()));
  await sleep(120);
  const typed = await changes();
  ok(
    "one message once typing pauses, with the whole text",
    typed.length === 1 && typed[0].code === "abc",
    JSON.stringify(typed)
  );

  await reset();
  await typeKeys("x".repeat(30), { gapMs: 20 });
  ok("a long burst still sends on the way", (await changes()).length >= 2, (await changes()).length);

  await reset();
  await typeKeys("q");
  await evaluate(`document.querySelector(".cm-content").blur()`);
  ok("leaving the editor sends at once", (await changes()).length === 1, (await changes()).length);
  // A closing tab takes the focus away first: the text stays for the app to take.
  ok("after a blur the text can still be taken", (await evaluate(`window.takePendingChange?.() ?? null`)) !== null);

  await reset();
  await typeKeys("w");
  await handle({ type: "flush" });
  ok("a flush request sends at once", (await changes()).length === 1, (await changes()).length);

  // On the web the page is a same-origin frame, and a closing tab never delivers a message posted while it closes: the
  // app takes the text not yet sent, synchronously.
  await reset();
  await typeKeys("t");
  const taken = await evaluate(`window.takePendingChange?.() ?? null`);
  const takenChange = taken && JSON.parse(taken);
  ok("the text not yet sent can be taken at once", takenChange?.type === "change" && takenChange.code.endsWith("t"), taken);
  await sleep(120);
  ok("once taken it isn't sent again", (await changes()).length === 0, JSON.stringify(await changes()));
  ok("nothing to take when everything was sent", (await evaluate(`window.takePendingChange?.() ?? null`)) === null);

  await reset();
  await typeKeys("v");
  await evaluate(`Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));`);
  ok("hiding the page sends at once", (await changes()).length === 1, (await changes()).length);
  await evaluate(`delete document.visibilityState`);
  // A closing tab unloads the frame before the app, and a message posted then never arrives: the text stays for the
  // app to take.
  ok("after a hide the text can still be taken", (await evaluate(`window.takePendingChange?.() ?? null`)) !== null);

  await reset();
  await typeKeys("p");
  await evaluate(`window.dispatchEvent(new Event("pagehide"))`);
  ok("leaving the page sends at once", (await changes()).length === 1, (await changes()).length);
  ok("after a pagehide the text can still be taken", (await evaluate(`window.takePendingChange?.() ?? null`)) !== null);

  // A tab switch replaces the document: the text typed in the old one and not sent yet goes at once, as that
  // document's last (`final`), so the app can store it in the tab it belongs to; the new document sends nothing.
  await reset();
  await typeKeys("z");
  await handle({ type: "setCode", code: "other", doc: 7 });
  const atSwitch = await changes();
  ok(
    "a replaced document sends its unsent text at once, as its last",
    atSwitch.length === 1 && atSwitch[0].final === true && atSwitch[0].doc !== 7 && atSwitch[0].code.endsWith("z"),
    JSON.stringify(atSwitch)
  );
  await sleep(120);
  ok("...and nothing else, old or new", (await changes()).length === 1, JSON.stringify(await changes()));

  await reset();
  await typeKeys("k");
  await handle({ type: "setCode", code: (await shownText()) + "!", doc: 8, remote: true });
  await sleep(120);
  const merged = (await changes()).at(-1);
  ok(
    "after another device's edit the merged text is sent with the new document's number",
    merged?.doc === 8 && merged?.code === "kother!",
    JSON.stringify(merged)
  );
  ok("no exception while typing", pageErrors.length === 0, pageErrors.join("\n"));
}

ws.close();
const exited = new Promise((resolve) => chrome.once("exit", resolve));
chrome.kill();
await exited;
rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("✗ " + f);
process.exit(failures.length ? 1 : 0);
