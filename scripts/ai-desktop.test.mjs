// The desktop's AI engine and model files (src/libs/ai/engine.web.ts, models.web.ts) over the Tauri commands, and the AI
// context on top of them: what the page sends to `ai_load`, `ai_complete`, `ai_download` and the others, and what it does
// with their answers. Run: node scripts/ai-desktop.test.mjs
//
// It bundles the real context.ts, constants.ts, helpers.ts, modelFiles.ts and the settings slice with esbuild, the web
// variants first (as Metro does for the desktop), with `@tauri-apps/api/core` faked: `invoke` records each call and answers
// from a handler the case sets; `Channel` is a class whose `onmessage` the handler drives.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
const entry = join(os.tmpdir(), "ai-desktop.entry.ts");
const out = join(os.tmpdir(), "ai-desktop.bundle.mjs");

const turn = () => new Promise((resolve) => setImmediate(resolve));
const settle = async () => {
  for (let i = 0; i < 20; i++) await turn();
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* The fakes                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The shell: every `invoke` made, what answers it, and the models folder. */
const tauri = {
  /** [command, args] of each `invoke`, in order. */
  calls: [],
  /** Everything that happened, in order: "flush", "complete", "stop"... */
  events: [],
  /** Per command: (args) => answer (or throws/rejects). A command without one answers undefined. */
  handlers: {},
  /** The models folder: file name -> size. */
  files: new Map(),
  isTauri: true,
  flushes: 0,
  reset() {
    this.calls = [];
    this.events = [];
    this.handlers = {};
    this.files = new Map();
    this.isTauri = true;
    this.flushes = 0;
  },
  count: (command) => tauri.calls.filter(([name]) => name === command).length,
  argsOf: (command) => tauri.calls.filter(([name]) => name === command).map(([, args]) => args),
};
globalThis.__tauri = tauri;

const storeState = {
  settings: {
    language: "it",
    aiAssistant: { enabled: false, modelDownloaded: false, selectedModel: "qwen3.5-2b", voiceOnly: false },
  },
  categories: { items: [] },
};
globalThis.__storeState = storeState;
globalThis.__dispatched = [];
globalThis.__asyncStorage = new Map();

const STUBS = {
  "@tauri-apps/api/core": `
    const tauri = globalThis.__tauri;
    export class Channel {
      constructor() { this.onmessage = () => {}; }
    }
    export async function invoke(command, args) {
      tauri.calls.push([command, args]);
      await new Promise((resolve) => setImmediate(resolve));
      const handler = tauri.handlers[command];
      if (!handler) throw new Error("no handler for " + command);
      return handler(args);
    }
  `,
  "@react-native-async-storage/async-storage": `
    const data = globalThis.__asyncStorage;
    export default {
      getItem: async (key) => (data.has(key) ? data.get(key) : null),
      setItem: async (key, value) => { data.set(key, value); },
    };
  `,
  "@/utils/platform": `export const isTauri = () => globalThis.__tauri.isTauri;`,
  "@/libs/flushOnExit": `
    export async function flushNow() {
      globalThis.__tauri.flushes++;
      globalThis.__tauri.events.push("flush");
    }
  `,
  "react-native": `
    export const AppState = { currentState: "active", addEventListener: () => ({ remove: () => {} }) };
    export const NativeModules = {};
    export const Platform = { OS: "web" };
  `,
  "expo-localization": `export const getLocales = () => [{ languageCode: "en" }];`,
  i18next: `export const t = (key) => key;`,
  "@/slicers/store": `
    export const store = {
      getState: () => ({ ...globalThis.__storeState }),
      dispatch: (action) => { globalThis.__dispatched.push(action); return action; },
    };
  `,
};

const resolver = {
  name: "ai-desktop-test-resolver",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => (STUBS[args.path] !== undefined ? { path: args.path, namespace: "stub" } : null));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

writeFileSync(
  entry,
  `
  import * as Context from "@/libs/ai/context";
  import * as Models from "@/libs/ai/models";
  import * as Engine from "@/libs/ai/engine";
  export const X = { ...Context, ...Models };
  export const E = Engine;
  export * as C from "@/libs/ai/constants";
  export * as D from "@/libs/ai/desktopDefaultModel";
`
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
  resolveExtensions: [".web.ts", ".web.tsx", ".ts", ".tsx", ".js", ".json"],
  plugins: [resolver],
});

const { X, E, C, D } = await import(pathToFileURL(out).href);

/* ------------------------------------------------------------------------------------------------------------------ */
/* The harness                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)?.slice(0, 800)}` : ""}`);
  }
}
const eq = (name, actual, expected) => ok(name, isDeepStrictEqual(actual, expected), actual);

// The model files at fake sizes (the real ones are gigabytes).
const FAKE_SIZE = { "qwen3.5-0.8b": 100, "qwen3.5-2b": 200, "qwen3.5-4b": 300 };
for (const id of Object.keys(C.AI_MODELS)) C.AI_MODELS[id].sizeBytes = FAKE_SIZE[id];
const fileOf = (id) => C.AI_MODELS[id].fileName;
const putModel = (id) => tauri.files.set(fileOf(id), FAKE_SIZE[id]);

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
  "<|endoftext|>",
];
const FAITHFUL = { temperature: 0.2, top_p: 0.8, top_k: 20, min_p: 0, penalty_repeat: 1, penalty_present: 0 };
const TEMPLATE = { jinja: true, enable_thinking: false, reasoning_format: "none" };
const RESULT = {
  text: "ok",
  timings: { prompt_n: 10, prompt_ms: 20, predicted_n: 5, predicted_ms: 50 },
  interrupted: false,
  stopped_limit: false,
  truncated: false,
  context_full: false,
};

/** The shell as it answers when nothing special is set up: the engine there, the models folder as `tauri.files` is. */
function defaultHandlers() {
  return {
    ai_info: () => ({ available: true, totalMemory: 8_000_000_000 }),
    ai_load: () => ({ gpu: false, reasonNoGpu: "fake", devices: ["CPU"] }),
    ai_tokenize: ({ text }) => Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i),
    ai_complete: ({ onToken }) => {
      tauri.events.push("complete");
      onToken.onmessage("ok");
      return RESULT;
    },
    ai_stop: () => {
      tauri.events.push("stop");
    },
    ai_release: () => {},
    ai_model_files: () => [...tauri.files].map(([fileName, size]) => ({ fileName, size })),
    ai_delete_files: ({ fileNames }) => {
      for (const name of fileNames) tauri.files.delete(name);
    },
    ai_download: ({ file }) => {
      tauri.files.set(file.fileName, file.size);
    },
    ai_download_cancel: () => {},
  };
}

/** Every case starts with no model loaded, the 3 models on the fake disk and the shell answering. */
async function fresh() {
  await X.releaseContext();
  await settle();
  tauri.reset();
  tauri.handlers = defaultHandlers();
  for (const id of Object.keys(C.AI_MODELS)) putModel(id);
  globalThis.__dispatched.length = 0;
  storeState.settings.aiAssistant = { enabled: false, modelDownloaded: false, selectedModel: "qwen3.5-2b", voiceOnly: false };
}

/** A promise settled by hand. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The cases                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("title goes to ai_complete");
{
  await fresh();
  const result = await X.generateEditorContent("generate_title", "Latte, pane e uova");
  const [{ params }] = tauri.argsOf("ai_complete");
  eq("the whole params: messages, template, 30 tokens, stop words, the FAITHFUL sampling", params, {
    messages: [
      { role: "system", content: C.getEditorSystemPrompt("generate_title", "it", "qwen3.5-2b") },
      { role: "user", content: "Latte, pane e uova" },
    ],
    ...TEMPLATE,
    n_predict: 30,
    stop: STOP_WORDS,
    ...FAITHFUL,
  });
  ok("no seed", !("seed" in params), params);
  eq("the answer", { success: result.success, text: result.text }, { success: true, text: "ok" });
}

console.log("load sends the bare name and desktop context");
{
  await fresh();
  await X.generateEditorContent("generate_title", "Una nota");
  const [load] = tauri.argsOf("ai_load");
  eq("2B: the bare file name, 16384 of context, every layer asked for", pick(load, ["fileName", "nCtx", "nGpuLayers"]), {
    fileName: "Qwen3.5-2B-Q4_K_M.gguf",
    nCtx: 16384,
    nGpuLayers: 99,
  });
  ok("a page id", typeof load.pageId === "string" && load.pageId.length > 0, load);
  eq("what the engine loaded on is the context's info", X.getContextInfo(), {
    gpu: false,
    reasonNoGPU: "fake",
    devices: ["CPU"],
    androidLib: undefined,
  });
  eq("the status is ready", X.getAIStatus(), "ready");
}

function pick(from, keys) {
  return Object.fromEntries(keys.map((key) => [key, from[key]]));
}

console.log("tokens stream in order");
{
  await fresh();
  tauri.handlers.ai_complete = ({ onToken }) => {
    onToken.onmessage("a");
    onToken.onmessage("b");
    return RESULT;
  };
  const context = await E.loadEngine({ model: fileOf("qwen3.5-2b"), n_ctx: 16384, n_gpu_layers: 99, use_mlock: false });
  const tokens = [];
  const result = await context.completion({ messages: [] }, (data) => tokens.push(data));
  eq("onToken gets each piece, in order", tokens, [{ token: "a" }, { token: "b" }]);
  eq("the result is Rust's", result, RESULT);
  eq("tokenize gives the tokens", await context.tokenize("abcdefgh"), { tokens: [0, 1] });
  await context.release();
  eq("release is ai_release", tauri.count("ai_release"), 1);
}

console.log("edits flushed before each completion");
{
  await fresh();
  await X.generateEditorContent("generate_title", "Una nota");
  await X.generateEditorContent("generate_title", "Un'altra nota");
  eq("flushNow ran twice, each right before its ai_complete", tauri.events, ["flush", "complete", "flush", "complete"]);
}

console.log("cancel stops in Rust");
{
  await fresh();
  const hold = deferred();
  tauri.handlers.ai_complete = async () => {
    tauri.events.push("complete");
    await hold.promise;
    return { ...RESULT, interrupted: true };
  };
  tauri.handlers.ai_stop = () => {
    tauri.events.push("stop");
    hold.resolve();
  };
  const run = X.generateEditorContent("generate_title", "Una nota");
  while (tauri.count("ai_complete") === 0) await turn();
  await X.cancelCommand();
  await run;
  eq("ai_stop was sent while the completion ran", tauri.events, ["flush", "complete", "stop"]);
}

console.log("the engine's support");
{
  await fresh();
  eq("an answer", await E.getEngineSupport(), { available: true, totalMemory: 8_000_000_000, reason: undefined });
  await E.getEngineSupport();
  eq("kept: ai_info is asked once", tauri.count("ai_info"), 1);
}

console.log("download success");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  const seen = [];
  const remove = X.addAIStatusListener((status, progress) => seen.push([status, progress]));
  const gate = deferred();
  tauri.handlers.ai_download = async ({ file, onProgress }) => {
    onProgress.onmessage({ received: file.size / 2, total: file.size });
    await gate.promise;
    tauri.files.set(file.fileName, file.size);
  };
  const run = X.downloadModel("qwen3.5-2b");
  while (tauri.count("ai_download") === 0) await turn();
  await turn();
  eq("half way is visible", X.getModelDownload(), { modelId: "qwen3.5-2b", progress: 0.5, waiting: false });
  eq("the file, its size and its SHA-256 go to Rust", tauri.argsOf("ai_download")[0].file, {
    fileName: "Qwen3.5-2B-Q4_K_M.gguf",
    url: C.AI_MODELS["qwen3.5-2b"].url,
    size: 200,
    sha256: "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
  });
  gate.resolve();
  eq("the download ends well", await run, true);
  remove();
  eq("no download any more", X.getModelDownload(), null);
  eq("no failure", X.getDownloadFailure(), null);
  eq("the status went downloading, half way, idle", seen, [
    ["downloading", 0],
    ["downloading", 0.5],
    ["idle", undefined],
  ]);
  const action = globalThis.__dispatched.find((a) => a.type?.includes("setAIAssistant"));
  ok("the AI is turned on", action?.payload.enabled === true && action.payload.modelDownloaded === true, action);
  eq("the model is downloaded", await X.isModelDownloaded("qwen3.5-2b"), true);
}

console.log("download no_space");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.handlers.ai_download = () => Promise.reject("no_space");
  const run = await X.downloadModel("qwen3.5-2b");
  eq("the download didn't end well", run, false);
  eq("the failure is no_space", X.getDownloadFailure(), "no_space");
  eq("the status is error", X.getAIStatus(), "error");
  eq("no download any more", X.getModelDownload(), null);
  eq("the AI is not turned on", globalThis.__dispatched.length, 0);
}
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.handlers.ai_download = () => Promise.reject("failed");
  await X.downloadModel("qwen3.5-2b");
  eq("any other failure is failed", X.getDownloadFailure(), "failed");
  tauri.handlers.ai_download = () => Promise.reject("busy");
  await X.downloadModel("qwen3.5-2b");
  eq("busy is failed too", [X.getDownloadFailure(), X.getAIStatus()], ["failed", "error"]);
}

console.log("download cancelled");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.handlers.ai_download = () => Promise.reject("cancelled");
  eq("a download ended by Rust's cancel is false", await X.downloadModel("qwen3.5-2b"), false);
  eq("the status is idle", X.getAIStatus(), "idle");
  eq("no failure", X.getDownloadFailure(), null);
  eq("no download any more", X.getModelDownload(), null);
}
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  const gate = deferred();
  tauri.handlers.ai_download = async () => {
    await gate.promise;
    return Promise.reject("cancelled");
  };
  tauri.handlers.ai_download_cancel = () => gate.resolve();
  const run = X.downloadModel("qwen3.5-2b");
  while (tauri.count("ai_download") === 0) await turn();
  await X.cancelDownload();
  eq("cancelDownload is ai_download_cancel", tauri.count("ai_download_cancel"), 1);
  eq("the download ended false", await run, false);
  eq(
    "the status is idle, with no failure",
    [X.getAIStatus(), X.getDownloadFailure(), X.getModelDownload()],
    ["idle", null, null]
  );
}

console.log("one model at a time");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.files.set("old-qwen-1.5b.gguf", 77);
  tauri.files.set(fileOf("qwen3.5-2b") + ".part", 50);
  await X.downloadModel("qwen3.5-2b");
  const deleted = tauri.argsOf("ai_delete_files").flatMap((args) => args.fileNames);
  eq("the 0.8B, the 4B and the old file are deleted, not the 2B's own .part", deleted.sort(), [
    fileOf("qwen3.5-0.8b"),
    fileOf("qwen3.5-4b"),
    "old-qwen-1.5b.gguf",
  ]);
  ok(
    "before the first ai_download",
    tauri.calls.findIndex(([c]) => c === "ai_delete_files") < tauri.calls.findIndex(([c]) => c === "ai_download")
  );
  eq("what is left", [...tauri.files.keys()].sort(), [fileOf("qwen3.5-2b"), fileOf("qwen3.5-2b") + ".part"].sort());
}
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.files.set(fileOf("qwen3.5-4b") + ".part", 10);
  await X.downloadModel("qwen3.5-2b");
  ok("another model's .part goes too", !tauri.files.has(fileOf("qwen3.5-4b") + ".part"), [...tauri.files.keys()]);
}
{
  await fresh();
  await X.downloadModel("qwen3.5-2b");
  eq("a model already whole is not downloaded again", tauri.count("ai_download"), 0);
}

console.log("whole files only");
{
  await fresh();
  tauri.files.set(fileOf("qwen3.5-2b"), FAKE_SIZE["qwen3.5-2b"] - 1);
  eq("a file 1 byte short is not downloaded", await X.isModelDownloaded("qwen3.5-2b"), false);
  eq("the others are", await X.isModelDownloaded("qwen3.5-4b"), true);
  eq("it is an orphan", await X.getOrphanedModelFiles(), [{ dir: "models", fileName: fileOf("qwen3.5-2b"), size: 199 }]);
  tauri.files.set(fileOf("qwen3.5-2b"), FAKE_SIZE["qwen3.5-2b"]);
  tauri.files.set(fileOf("qwen3.5-4b") + ".part", 5);
  eq("a catalog model's own .part is not an orphan (its download resumes it)", await X.getOrphanedModelFiles(), []);
  tauri.files.set("Unknown-model.gguf.part", 7);
  tauri.files.set("qwen-1.5b-old.gguf", 9);
  eq(
    "a .part of no catalog model, and an old model's file, are orphans",
    (await X.getOrphanedModelFiles()).map(({ fileName, size }) => [fileName, size]).sort(),
    [
      ["Unknown-model.gguf.part", 7],
      ["qwen-1.5b-old.gguf", 9],
    ]
  );
  tauri.calls.length = 0;
  eq("deleting the old ones counts only them", await X.deleteOrphanedModelFiles(), 16);
  eq(
    "... and leaves the catalog .part",
    [...tauri.files.keys()].includes(fileOf("qwen3.5-4b") + ".part") && !tauri.files.has("qwen-1.5b-old.gguf"),
    true
  );
  tauri.files.delete(fileOf("qwen3.5-4b") + ".part");
  eq("the bare name is the path", await X.getModelPath("qwen3.5-2b"), "Qwen3.5-2B-Q4_K_M.gguf");
}

console.log("deleting files");
{
  await fresh();
  await X.generateEditorContent("generate_title", "Una nota");
  tauri.files.set("old.gguf", 50);
  tauri.calls.length = 0;
  eq("an orphan is deleted, its bytes counted", await X.deleteOrphanedModelFiles(), 50);
  eq(
    "the loaded model is released before the delete",
    tauri.calls.map(([c]) => c),
    ["ai_model_files", "ai_release", "ai_delete_files"]
  );
  tauri.files.set(fileOf("qwen3.5-4b") + ".part", 5);
  await X.deleteModelFiles("qwen3.5-4b");
  eq(
    "a model's files go with its .part",
    [...tauri.files.keys()].some((name) => name.includes("4B")),
    false
  );
}

console.log("an engine that rejects");
{
  await fresh();
  tauri.handlers.ai_load = () => Promise.reject("engine: boom");
  const quiet = console.error;
  console.error = () => {};
  const result = await X.generateEditorContent("generate_title", "Una nota");
  console.error = quiet;
  eq("the action fails and the status is error", [result.success, X.getAIStatus()], [false, "error"]);
}

console.log("browser: no Tauri calls");
{
  await fresh();
  tauri.isTauri = false;
  eq("no engine", E.isEngineAvailable(), false);
  eq("not available, nothing asked", await E.getEngineSupport(), { available: false, totalMemory: null, reason: "missing" });
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  eq("the AI can't start", await X.initContext("qwen3.5-2b"), false);
  console.warn = warn;
  eq("the warning is not the Android one", warnings, ["[AI] Engine not available on this platform"]);
  eq("no model files", [await X.isModelDownloaded("qwen3.5-2b"), await X.getOrphanedModelFiles()], [false, []]);
  eq("no download", await X.downloadModel("qwen3.5-2b"), false);
  eq("zero invokes", tauri.calls.length, 0);
}

console.log("a download without a pinned SHA-256 doesn't start");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  const sha = C.AI_MODELS["qwen3.5-2b"].sha256;
  C.AI_MODELS["qwen3.5-2b"].sha256 = "";
  const quiet = console.error;
  console.error = () => {};
  eq("refused", await X.downloadModel("qwen3.5-2b"), false);
  console.error = quiet;
  C.AI_MODELS["qwen3.5-2b"].sha256 = sha;
  eq("nothing deleted, nothing downloaded", [tauri.count("ai_delete_files"), tauri.count("ai_download")], [0, 0]);
  eq("failed", [X.getDownloadFailure(), X.getAIStatus()], ["failed", "error"]);
}

console.log("a failed ai_info is asked again");
{
  // a module state of its own: the bundle is loaded again
  const { E: E2 } = await import(pathToFileURL(out).href + "?again");
  await fresh();
  tauri.handlers.ai_info = () => Promise.reject("engine: boom");
  const quiet = console.error;
  console.error = () => {};
  eq("a rejection is an error answer", await E2.getEngineSupport(), { available: false, totalMemory: null, reason: "error" });
  console.error = quiet;
  tauri.handlers.ai_info = () => ({ available: false, reason: "cpu", totalMemory: null });
  eq("asked again, and the answer kept", await E2.getEngineSupport(), { available: false, totalMemory: null, reason: "cpu" });
  eq("two asks", tauri.count("ai_info"), 2);
}

console.log("a cancel while the download is being prepared");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  const gate = deferred();
  let listings = 0;
  const list = tauri.handlers.ai_model_files;
  tauri.handlers.ai_model_files = async () => {
    // the first listing is the clean-up's; the second is the one before the file's download
    if (++listings === 2) await gate.promise;
    return list();
  };
  const run = X.downloadModel("qwen3.5-2b");
  while (listings < 2) await turn();
  const cancelled = X.cancelDownload();
  gate.resolve();
  const outcome = await Promise.race([
    Promise.all([cancelled, run]).then(([, result]) => result),
    new Promise((resolve) => setTimeout(() => resolve("hung"), 500)),
  ]);
  eq("the download ended false, and the cancel with it", outcome, false);
  eq("ai_download was never invoked", tauri.count("ai_download"), 0);
  eq("idle, no failure, no download", [X.getAIStatus(), X.getDownloadFailure(), X.getModelDownload()], ["idle", null, null]);
}

console.log("a new download while another is being cancelled");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.files.delete(fileOf("qwen3.5-0.8b"));
  const gate = deferred();
  tauri.handlers.ai_download = async ({ file }) => {
    if (file.fileName === fileOf("qwen3.5-0.8b")) {
      await gate.promise;
      return Promise.reject("cancelled");
    }
    tauri.files.set(file.fileName, file.size);
  };
  tauri.handlers.ai_download_cancel = () => gate.resolve();
  const first = X.downloadModel("qwen3.5-0.8b");
  while (tauri.count("ai_download") === 0) await turn();
  const [a, b] = await Promise.all([X.downloadModel("qwen3.5-2b"), X.downloadModel("qwen3.5-2b")]);
  eq("both callers get the same answer: it downloaded", [a, b], [true, true]);
  eq("the first one ended false", await first, false);
  eq(
    "exactly one ai_download for the 2B",
    tauri.argsOf("ai_download").filter((args) => args.file.fileName === fileOf("qwen3.5-2b")).length,
    1
  );
  eq("no failure, idle", [X.getDownloadFailure(), X.getAIStatus()], [null, "idle"]);
}

console.log("the same model joins the download under way");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  const gate = deferred();
  tauri.handlers.ai_download = async ({ file }) => {
    await gate.promise;
    tauri.files.set(file.fileName, file.size);
  };
  const first = X.downloadModel("qwen3.5-2b");
  while (tauri.count("ai_download") === 0) await turn();
  const second = X.downloadModel("qwen3.5-2b");
  gate.resolve();
  eq("both end well", await Promise.all([first, second]), [true, true]);
  eq("one ai_download", tauri.count("ai_download"), 1);
}

console.log("a model folder that can't be listed");
{
  await fresh();
  tauri.files.delete(fileOf("qwen3.5-2b"));
  tauri.handlers.ai_model_files = () => Promise.reject("failed: io");
  const seen = [];
  const remove = X.addAIStatusListener((status) => seen.push(status));
  const quiet = console.error;
  console.error = () => {};
  eq("the download ends false", await X.downloadModel("qwen3.5-2b"), false);
  console.error = quiet;
  remove();
  eq("failed, and said so", [X.getDownloadFailure(), X.getAIStatus(), X.getModelDownload()], ["failed", "error", null]);
  eq("the status went downloading, error", seen, ["downloading", "error"]);
  eq("nothing deleted, nothing downloaded", [tauri.count("ai_delete_files"), tauri.count("ai_download")], [0, 0]);
}

console.log("a delete refused because a download runs in Rust");
{
  await fresh();
  tauri.files.set("old.gguf", 50);
  tauri.handlers.ai_delete_files = () => Promise.reject("busy");
  const logged = [];
  const quiet = console.error;
  console.error = (...args) => logged.push(args);
  eq("busy: nothing freed", await X.deleteOrphanedModelFiles(), 0);
  eq("busy is no error", logged, []);
  tauri.handlers.ai_delete_files = () => Promise.reject("failed: io");
  eq("another failure: nothing freed", await X.deleteOrphanedModelFiles(), 0);
  console.error = quiet;
  eq("another failure is logged", logged.length, 1);
}

console.log("parallel first calls share one ai_info");
{
  const { E: E3 } = await import(pathToFileURL(out).href + "?parallel");
  await fresh();
  const gate = deferred();
  tauri.handlers.ai_info = async () => {
    await gate.promise;
    return { available: true, totalMemory: 1 };
  };
  const calls = [E3.getEngineSupport(), E3.getEngineSupport()];
  gate.resolve();
  const [one, two] = await Promise.all(calls);
  eq("one invoke", tauri.count("ai_info"), 1);
  eq("same answer", [one.available, two.available], [true, true]);
}
{
  const { E: E4 } = await import(pathToFileURL(out).href + "?parallel-reject");
  await fresh();
  tauri.handlers.ai_info = () => Promise.reject("engine: boom");
  const quiet = console.error;
  console.error = () => {};
  const both = await Promise.all([E4.getEngineSupport(), E4.getEngineSupport()]);
  console.error = quiet;
  eq(
    "a rejection answers both with error",
    both.map((support) => support.reason),
    ["error", "error"]
  );
  eq("still one invoke", tauri.count("ai_info"), 1);
  tauri.handlers.ai_info = () => ({ available: true, totalMemory: 2 });
  eq("a later call asks again", (await E4.getEngineSupport()).available, true);
  eq("two invokes in all", tauri.count("ai_info"), 2);
}

console.log("the desktop's default model, written once");
{
  const storage = globalThis.__asyncStorage;
  const KEY = "@aiDefaultModelChecked";
  const OLD = { enabled: false, selectedModel: "qwen3.5-0.8b" };
  let asked = 0;
  const noFile = async () => (asked++, false);
  const aFile = async () => (asked++, true);

  storage.clear();
  eq("key absent, no file, AI off, the old default: the 2B", await D.desktopDefaultModelToStore(OLD, noFile), "qwen3.5-2b");
  eq("the key is set", storage.has(KEY), true);
  eq("the model files were asked", asked, 1);

  eq("key present: nothing, and no file asked", await D.desktopDefaultModelToStore(OLD, noFile), null);
  eq("the files were not asked again", asked, 1);

  storage.clear();
  eq("a model file there: nothing", await D.desktopDefaultModelToStore(OLD, aFile), null);
  eq("the key is set anyway", storage.has(KEY), true);

  storage.clear();
  eq("the AI on: nothing", await D.desktopDefaultModelToStore({ ...OLD, enabled: true }, noFile), null);
  eq("the key is set anyway (AI on)", storage.has(KEY), true);

  storage.clear();
  eq(
    "another model stored: nothing",
    await D.desktopDefaultModelToStore({ ...OLD, selectedModel: "qwen3.5-4b" }, noFile),
    null
  );
  eq("the key is set anyway (another model)", storage.has(KEY), true);

  storage.clear();
  eq(
    "the 2B already stored: nothing",
    await D.desktopDefaultModelToStore({ ...OLD, selectedModel: "qwen3.5-2b" }, noFile),
    null
  );

  storage.clear();
  const failing = async () => {
    throw new Error("boom");
  };
  let thrown = false;
  try {
    await D.desktopDefaultModelToStore(OLD, failing);
  } catch {
    thrown = true;
  }
  eq("a failed file check is not an answer: it throws and the key stays unset", [thrown, storage.has(KEY)], [true, false]);
  storage.clear();
}

await fresh();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
