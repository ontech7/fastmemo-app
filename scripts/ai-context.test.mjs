// What the AI context (src/libs/ai/context.ts) sends to llama.rn and what it returns: the model it loads, the params of every
// completion, the answers it keeps or refuses, the one-at-a-time queue, cancels, and when it lets the model go.
// Run: node scripts/ai-context.test.mjs
//
// A characterization test: it describes what context.ts does, so that moving its code (per platform) can prove it changed
// nothing on Android. It bundles the real context.ts, constants.ts, helpers.ts and the settings slice with esbuild, with
// llama.rn, react-native and the file system faked (the model files on the fake disk, the answers scripted by each case).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
const entry = join(os.tmpdir(), "ai-context.entry.ts");
const out = join(os.tmpdir(), "ai-context.bundle.mjs");

/* ------------------------------------------------------------------------------------------------------------------ */
/* The fakes                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

const turn = () => new Promise((resolve) => setImmediate(resolve));

// The disk of scripts/_expo-file-system-legacy-fake.js: just what it asks of it.
globalThis.__fakeDisk = {
  files: new Map(),
  dirs: new Set(["/data/files", "/data/files/models"]),
  step() {},
  write(path, text) {
    this.files.set(path, { text, mtime: 1 });
  },
  remove(path) {
    this.files.delete(path);
  },
  rename(from, to) {
    this.files.set(to, this.files.get(from));
    this.files.delete(from);
  },
};

/** What the fake llama.rn did, and what it is told to answer. */
const llama = {
  /** Params of each `initLlama`. */
  inits: [],
  /** Each context it made. */
  contexts: [],
  /** Params of each `completion`, in order. */
  completions: [],
  /** Everything that happened, in order: "init <file>", "start 1", "end 1", "release <file>". */
  events: [],
  /** The answers to give, one per completion (a missing one answers "ok"). */
  scripts: [],
  running: 0,
  maxRunning: 0,
  reset() {
    this.inits = [];
    this.contexts = [];
    this.completions = [];
    this.events = [];
    this.scripts = [];
    this.running = 0;
    this.maxRunning = 0;
  },
};
globalThis.__llama = llama;
globalThis.__turn = turn;

/** The app state of react-native: `emit` is the test's way to move the app to the background. */
const appState = { currentState: "active", listeners: [] };
globalThis.__appState = appState;

/** The settings and categories the store gives, and the actions dispatched to it. */
const storeState = {
  settings: {
    language: "it",
    aiAssistant: { enabled: true, modelDownloaded: true, selectedModel: "qwen3.5-2b", voiceOnly: false },
  },
  categories: { items: [] },
};
globalThis.__storeState = storeState;
globalThis.__dispatched = [];

const STUBS = {
  "llama.rn": `
    const llama = globalThis.__llama;
    const fileOf = (model) => model.slice(model.lastIndexOf("/") + 1);
    export async function initLlama(params) {
      await globalThis.__turn();
      llama.inits.push(params);
      llama.events.push("init " + fileOf(params.model));
      const context = {
        params,
        gpu: false,
        reasonNoGPU: "fake",
        stopRequested: false,
        stopCalls: 0,
        releaseCalls: 0,
        tokenize: async (text) => ({ tokens: Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i) }),
        stopCompletion: async () => {
          context.stopCalls++;
          context.stopRequested = true;
        },
        release: async () => {
          context.releaseCalls++;
          llama.events.push("release " + fileOf(params.model));
        },
        completion: async (params, onToken) => {
          const n = llama.completions.length + 1;
          llama.completions.push(params);
          llama.events.push("start " + n);
          llama.running++;
          llama.maxRunning = Math.max(llama.maxRunning, llama.running);
          context.stopRequested = false;
          const script = llama.scripts.shift() ?? {};
          const text = script.text ?? "ok";
          const tokens = script.tokens ?? text.match(/.{1,3}/gs) ?? [];
          let interrupted = false;
          try {
            for (let i = 0; i < tokens.length; i++) {
              await globalThis.__turn();
              if (context.stopRequested) {
                interrupted = true;
                break;
              }
              onToken?.({ token: tokens[i] });
              if (i === 0 && script.hold) await script.hold;
            }
          } finally {
            llama.running--;
            llama.events.push("end " + n);
          }
          return {
            text: interrupted ? tokens.join("") : text,
            timings: { prompt_n: 10, prompt_ms: 20, predicted_n: 5, predicted_ms: 50 },
            interrupted,
            stopped_limit: false,
            truncated: false,
            context_full: false,
            completion_probabilities: [],
            ...script.result,
          };
        },
      };
      llama.contexts.push(context);
      return context;
    }
  `,
  "react-native": `
    const state = globalThis.__appState;
    export const AppState = {
      get currentState() { return state.currentState; },
      addEventListener: (type, listener) => {
        state.listeners.push(listener);
        return { remove: () => {} };
      },
    };
    export const NativeModules = { RNLlama: {} };
    export const Platform = { OS: "android" };
  `,
  "expo-localization": `export const getLocales = () => [{ languageCode: "en" }];`,
  i18next: `export const t = (key) => key;`,
  "expo-device": `export default {};`,
  "~/modules/fastmemo-downloads": `export default null;`,
  "@/slicers/store": `
    export const store = {
      getState: () => globalThis.__storeState,
      dispatch: (action) => { globalThis.__dispatched.push(action); return action; },
    };
  `,
};

const resolver = {
  name: "ai-context-test-resolver",
  setup(b) {
    b.onResolve({ filter: /^expo-file-system\/legacy$/ }, () => ({
      path: join(__dirname, "_expo-file-system-legacy-fake.js"),
    }));
    b.onResolve({ filter: /.*/ }, (args) => (STUBS[args.path] !== undefined ? { path: args.path, namespace: "stub" } : null));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

writeFileSync(
  entry,
  `
  export * as X from "@/libs/ai/context";
  export * as C from "@/libs/ai/constants";
  export * as H from "@/libs/ai/helpers";
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
  plugins: [resolver],
});

const { X, C, H } = await import(pathToFileURL(out).href);

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

// The model files, at fake sizes (the real ones are gigabytes): each is on the fake disk at exactly its size.
const MODELS_DIR = "file:///data/files/models/";
const FAKE_SIZE = { "qwen3.5-0.8b": 100, "qwen3.5-2b": 200, "qwen3.5-4b": 300 };
for (const id of Object.keys(C.AI_MODELS)) {
  C.AI_MODELS[id].sizeBytes = FAKE_SIZE[id];
  globalThis.__fakeDisk.write(`/data/files/models/${C.AI_MODELS[id].fileName}`, "x".repeat(FAKE_SIZE[id]));
}
const modelUri = (id) => `${MODELS_DIR}${C.AI_MODELS[id].fileName}`;

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
const GENERATIVE = { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, penalty_repeat: 1, penalty_present: 1 };
const TEMPLATE = { jinja: true, enable_thinking: false, reasoning_format: "none" };
const TIMINGS = { promptN: 10, promptMs: 20, predictedN: 5, predictedMs: 50 };

const selectModel = (selectedModel) => {
  storeState.settings.aiAssistant = { ...storeState.settings.aiAssistant, selectedModel };
};
const answer = (...scripts) => llama.scripts.push(...scripts);
/** Lets the pending work settle (a release started with `void`, a load). */
const settle = async () => {
  for (let i = 0; i < 20; i++) await turn();
};

/** Every case starts with no model loaded, the app in the foreground and nothing scripted. */
async function fresh() {
  globalThis.setTimeout = realTimers.setTimeout;
  globalThis.clearTimeout = realTimers.clearTimeout;
  await X.releaseContext();
  await settle();
  llama.reset();
  appState.currentState = "active";
  globalThis.__dispatched.length = 0;
  storeState.settings = {
    language: "it",
    aiAssistant: { enabled: true, modelDownloaded: true, selectedModel: "qwen3.5-2b", voiceOnly: false },
  };
  storeState.categories.items = [];
}

const realTimers = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };

/** A clock the test moves: `setTimeout` and `clearTimeout` are replaced until `fresh()` puts the real ones back. */
function fakeClock() {
  let now = 0;
  let next = 0;
  const timers = new Map();
  globalThis.setTimeout = (fn, ms) => {
    timers.set(++next, { fn, at: now + ms });
    return next;
  };
  globalThis.clearTimeout = (id) => {
    timers.delete(id);
  };
  return {
    pending: () => timers.size,
    async advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= now && timers.delete(id)) timer.fn();
      }
      await settle();
    },
  };
}

const releases = () => llama.contexts.reduce((sum, context) => sum + context.releaseCalls, 0);
const pick = (from, like) => Object.fromEntries(Object.keys(like).map((key) => [key, from[key]]));
const lastCompletion = () => llama.completions[llama.completions.length - 1];

/* ------------------------------------------------------------------------------------------------------------------ */
/* The cases                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("loads the selected model");
{
  await fresh();
  selectModel("qwen3.5-2b");
  const result = await X.generateEditorContent("generate_title", "Una nota sulla spesa");
  ok("the 2B answers", result.success === true, result);
  eq("2B: loaded once, with the file, 8192 of context, every layer on the GPU and pinned in RAM", llama.inits, [
    { model: "file:///data/files/models/Qwen3.5-2B-Q4_K_M.gguf", n_ctx: 8192, n_gpu_layers: 99, use_mlock: true },
  ]);
  eq("the loaded context is the model the settings name", X.getContextInfo(), {
    gpu: false,
    reasonNoGPU: "fake",
    devices: undefined,
    androidLib: undefined,
  });
  eq("the status is ready after a completion", X.getAIStatus(), "ready");

  await fresh();
  selectModel("qwen3.5-4b");
  await X.generateEditorContent("generate_title", "Una nota sulla spesa");
  eq("4B: not pinned in RAM", llama.inits, [
    { model: "file:///data/files/models/Qwen3.5-4B-Q4_K_M.gguf", n_ctx: 8192, n_gpu_layers: 99, use_mlock: false },
  ]);

  await fresh();
  selectModel("qwen3.5-2b");
  eq("a model whose file is not on the disk is not loaded", await X.isModelDownloaded("qwen3.5-2b"), true);
  globalThis.__fakeDisk.remove("/data/files/models/Qwen3.5-2B-Q4_K_M.gguf");
  const missing = await X.generateEditorContent("generate_title", "Una nota sulla spesa");
  eq("... the action says the model is not ready", missing, { success: false, error: "Model not ready" });
  eq("... and initLlama was never called", llama.inits.length, 0);
  globalThis.__fakeDisk.write("/data/files/models/Qwen3.5-2B-Q4_K_M.gguf", "x".repeat(FAKE_SIZE["qwen3.5-2b"] - 1));
  eq("a file of another size is not the model", await X.isModelDownloaded("qwen3.5-2b"), false);
  globalThis.__fakeDisk.write("/data/files/models/Qwen3.5-2B-Q4_K_M.gguf", "x".repeat(FAKE_SIZE["qwen3.5-2b"]));
}

console.log("every completion uses the template with thinking off");
{
  await fresh();
  await X.generateEditorContent("generate_title", "Una nota sulla spesa");
  const p = lastCompletion();
  eq(
    "editor action: jinja, thinking off, reasoning left in the text",
    { jinja: p.jinja, enable_thinking: p.enable_thinking, reasoning_format: p.reasoning_format },
    TEMPLATE
  );
  eq("editor action: the 9 stop words", p.stop, STOP_WORDS);
  eq("the stop words are exactly 9", p.stop.length, 9);

  answer({ text: "[0]" });
  await X.searchHelpByIntent("come faccio", [{ base: "k0", title: "Uno" }]);
  const h = lastCompletion();
  eq(
    "help search: jinja, thinking off, reasoning left in the text",
    { jinja: h.jinja, enable_thinking: h.enable_thinking, reasoning_format: h.reasoning_format },
    TEMPLATE
  );
  eq("help search: the 9 stop words", h.stop, STOP_WORDS);
}

console.log("title");
{
  await fresh();
  answer({ text: "Spesa della settimana" });
  const result = await X.generateEditorContent("generate_title", "Latte, pane e uova");
  const p = lastCompletion();
  eq("n_predict is 30", p.n_predict, 30);
  eq("the whole params: messages, template, 30 tokens, stop words, the FAITHFUL sampling, no grammar", p, {
    messages: [
      { role: "system", content: C.getEditorSystemPrompt("generate_title", "it", "qwen3.5-2b") },
      { role: "user", content: "Latte, pane e uova" },
    ],
    ...TEMPLATE,
    n_predict: 30,
    stop: STOP_WORDS,
    ...FAITHFUL,
  });
  eq(
    "the system prompt is the 2B's prompt in the app's language",
    p.messages[0].content,
    C.getEditorSystemPrompt("generate_title", "it", "qwen3.5-2b")
  );
  eq(
    "the answer",
    { success: result.success, text: result.text, timings: result.timings },
    {
      success: true,
      text: "Spesa della settimana",
      timings: TIMINGS,
    }
  );

  // a 2,000-char input is cut on a word boundary
  const original = "lorem ipsum dolor ".repeat(120).trim();
  ok("the input is longer than 2,000 chars", original.length > 2000, original.length);
  await X.generateEditorContent("generate_title", original);
  const sent = lastCompletion().messages[1].content;
  ok("a long input arrives at 800 chars or fewer", sent.length <= 800, sent.length);
  ok("... as the start of the input", original.startsWith(sent));
  ok(
    "... cut at a word boundary",
    original[sent.length] === " " && sent.split(" ").every((w) => ["lorem", "ipsum", "dolor"].includes(w)),
    sent.slice(-20)
  );
  ok("... and not much shorter than the cap", sent.length > 780, sent.length);

  // the language: the option wins over the settings, the 0.8B has its own prompt
  await X.generateEditorContent("generate_title", "Hello", undefined, { lang: "en" });
  eq(
    "options.lang wins over the settings",
    lastCompletion().messages[0].content,
    C.getEditorSystemPrompt("generate_title", "en", "qwen3.5-2b")
  );
  eq("the language of the settings", X.resolveLanguage(), "it");

  // the seed: only the evaluation passes one; the app's own actions send none
  await X.generateEditorContent("generate_title", "Latte, pane e uova");
  const unseeded = lastCompletion();
  ok("no seed by default: the params have no seed key", !("seed" in unseeded), unseeded);
  await X.generateEditorContent("generate_title", "Latte, pane e uova", undefined, { seed: 42 });
  const seeded = lastCompletion();
  eq("the eval's seed reaches the model", seeded.seed, 42);
  const { seed, ...rest } = seeded;
  eq("... and is the only change to the params", rest, unseeded);
}

console.log("grammar fix budget");
{
  await fresh();
  const budget = (tokens, contextSize, max = 800, factor = 1.6) =>
    Math.max(64, Math.min(contextSize - tokens - 256, Math.max(max, Math.ceil(tokens * factor) + 32)));

  const text400 = "Questo è un testo con qualche errore. ".repeat(11).slice(0, 400);
  eq("400 chars are 100 fake tokens", text400.length, 400);
  answer({ text: text400 });
  const result = await X.generateEditorContent("fix_grammar", text400);
  eq("400 chars: n_predict by the formula", lastCompletion().n_predict, budget(100, 8192));
  eq("400 chars: n_predict is the floor of 800", lastCompletion().n_predict, 800);
  eq("fix_grammar: the template, the FAITHFUL sampling, no grammar", lastCompletion(), {
    messages: lastCompletion().messages,
    ...TEMPLATE,
    n_predict: 800,
    stop: STOP_WORDS,
    ...FAITHFUL,
  });
  ok("... and the rewrite comes back", result.success === true && result.text === text400.trim(), result);

  // a long input: the budget grows with it (1,000 tokens of input: 1.6 x + 32)
  const text4000 = "Questo è un testo con qualche errore. ".repeat(106).slice(0, 4000);
  answer({ text: text4000 });
  await X.generateEditorContent("fix_grammar", text4000);
  eq("4,000 chars (1,000 tokens): the budget grows", lastCompletion().n_predict, budget(1000, 8192));
  eq("... to 1.6 x the input + 32", lastCompletion().n_predict, 1632);

  // the room left in the context caps it, and 64 is the floor
  const text14000 = "a".repeat(14000);
  answer({ text: text14000 });
  await X.generateEditorContent("fix_grammar", text14000, undefined, { modelId: "qwen3.5-0.8b" });
  eq("0.8B, 14,000 chars (3,500 tokens): the room left in 4096", lastCompletion().n_predict, budget(3500, 4096));
  eq("... which is 340", lastCompletion().n_predict, 340);
  const text15400 = "a".repeat(15400);
  answer({ text: text15400 });
  await X.generateEditorContent("fix_grammar", text15400, undefined, { modelId: "qwen3.5-0.8b" });
  eq("0.8B, 15,400 chars: no room is the floor of 64", lastCompletion().n_predict, 64);
  eq("... and the model loaded was the one asked for", llama.contexts.length, 2);

  // an answer that ran out of room is not applied
  await fresh();
  answer({ text: "Questo è un testo con", result: { stopped_limit: true } });
  const cut = await X.generateEditorContent("fix_grammar", text400);
  eq("stopped_limit: too_long", { success: cut.success, error: cut.error }, { success: false, error: "too_long" });
  eq("... with the timings", cut.timings, TIMINGS);
  answer({ text: "Questo è un testo con", result: { truncated: true } });
  eq("truncated: too_long", (await X.generateEditorContent("fix_grammar", text400)).error, "too_long");
  answer({ text: "Questo è un testo con", result: { context_full: true } });
  eq("context_full: too_long", (await X.generateEditorContent("fix_grammar", text400)).error, "too_long");
  answer({ text: "Una frase. Poi un", result: { stopped_limit: true } });
  eq(
    "a title that ran out of room is a plain 'No response'",
    (await X.generateEditorContent("generate_title", "ciao")).error,
    "No response"
  );
}

console.log("items");
{
  await fresh();
  answer({ text: '["a","b","c"]' });
  const result = await X.generateEditorContent("suggest_items", "Spesa");
  const p = lastCompletion();
  eq("the grammar is JSON_ARRAY_GRAMMAR", p.grammar, C.JSON_ARRAY_GRAMMAR);
  eq(
    "n_predict is 100 and the sampling the GENERATIVE one",
    { n_predict: p.n_predict, ...pick(p, GENERATIVE) },
    { n_predict: 100, ...GENERATIVE }
  );
  eq("the items cleanSuggestedItems gives today (trimmed, as written)", result.items, ["a", "b", "c"]);
  eq("... which is what the helper gives", result.items, H.cleanSuggestedItems(["a", "b", "c"], ["Spesa"]));
  eq(
    "the answer",
    { success: result.success, text: result.text, timings: result.timings },
    { success: true, text: undefined, timings: TIMINGS }
  );

  // what the list already has (title, then one item per line) is left out; duplicates and blanks too
  answer({ text: '["Latte","pane","Pane"," uova ",""]' });
  const rest = await X.generateEditorContent("suggest_items", "Spesa\nlatte");
  eq("items the list has are left out, each once, trimmed", rest.items, ["pane", "uova"]);

  // not JSON: the quoted strings are taken
  answer({ text: 'Ecco: "uno" e "due"' });
  const loose = await X.generateEditorContent("suggest_items", "Lista");
  eq("a stray answer: its quoted strings", loose.items, ["uno", "due"]);
  answer({ text: "nessuna lista" });
  eq("an answer with no strings", (await X.generateEditorContent("suggest_items", "Lista")).error, "Invalid response format");
  answer({ text: '["lista"]' });
  eq("nothing new is 'No items'", (await X.generateEditorContent("suggest_items", "Lista")).error, "No items");

  // dictation to items: the grammar too, a budget that grows with the input, the list kept whole
  answer({ text: '["Latte","Pane"]' });
  const dictated = await X.generateEditorContent("transcript_to_items", "latte e pane");
  eq("transcript_to_items: the same grammar", lastCompletion().grammar, C.JSON_ARRAY_GRAMMAR);
  eq("transcript_to_items: the items", dictated.items, ["Latte", "Pane"]);

  // the whole params of each: a pin of what the model is sent (the template, the stop words, the sampling, the grammar)
  await fresh();
  answer({ text: '["a","b","c"]' });
  await X.generateEditorContent("suggest_items", "Spesa");
  eq("suggest_items: the whole params", lastCompletion(), {
    messages: [
      { role: "system", content: C.getEditorSystemPrompt("suggest_items", "it", "qwen3.5-2b") },
      { role: "user", content: "Spesa" },
    ],
    ...TEMPLATE,
    n_predict: 100,
    stop: STOP_WORDS,
    ...GENERATIVE,
    grammar: C.JSON_ARRAY_GRAMMAR,
  });
  answer({ text: '["Latte","Pane"]' });
  await X.generateEditorContent("transcript_to_items", "latte e pane");
  eq("transcript_to_items: the whole params", lastCompletion(), {
    messages: [
      { role: "system", content: C.getEditorSystemPrompt("transcript_to_items", "it", "qwen3.5-2b") },
      { role: "user", content: "latte e pane" },
    ],
    ...TEMPLATE,
    n_predict: 300,
    stop: STOP_WORDS,
    ...FAITHFUL,
    grammar: C.JSON_ARRAY_GRAMMAR,
  });
}

console.log("category");
{
  await fresh();
  const names = ["Spesa", "Lavoro", "Svago"];
  storeState.categories.items = names.map((name) => ({ name }));
  const note = "Compro latte e pane";

  const steps = (rival) => [
    {
      content: "Spesa",
      probs: [
        { tok_str: "Spesa", prob: 0.9 },
        { tok_str: "Svago", prob: rival },
      ],
    },
  ];

  answer({ text: "Spesa", result: { completion_probabilities: steps(0.6) } });
  const near = await X.generateEditorContent("suggest_category", note);
  const p = lastCompletion();
  eq("the grammar is the category names and none", p.grammar, H.categoryGrammar(names));
  eq("... as the helper builds it", p.grammar, 'root ::= "Spesa" | "Lavoro" | "Svago" | "none"');
  eq("n_probs is 10", p.n_probs, 10);
  eq("suggest_category: the whole params", p, {
    messages: [
      { role: "system", content: C.getEditorSystemPrompt("suggest_category", "it", "qwen3.5-2b") },
      { role: "user", content: `Categories: ${names.join(", ")}\n\nNote:\n${note}` },
    ],
    ...TEMPLATE,
    n_predict: 30,
    stop: STOP_WORDS,
    ...FAITHFUL,
    grammar: H.categoryGrammar(names),
    n_probs: 10,
  });
  eq("n_predict is 30, the FAITHFUL sampling", [p.n_predict, p.temperature, p.penalty_present], [30, 0.2, 0]);
  eq("the user message lists the categories", p.messages[1].content, `Categories: Spesa, Lavoro, Svago\n\nNote:\n${note}`);
  eq(
    "a close runner-up is the alternative",
    { success: near.success, text: near.text, alternative: near.alternative },
    {
      success: true,
      text: "Spesa",
      alternative: "Svago",
    }
  );

  answer({ text: "Spesa", result: { completion_probabilities: steps(0.000001) } });
  const far = await X.generateEditorContent("suggest_category", note);
  eq(
    "a far one is not",
    { success: far.success, text: far.text, alternative: far.alternative },
    {
      success: true,
      text: "Spesa",
      alternative: undefined,
    }
  );

  // the name is found whatever its case; "none" and nothing are no match
  answer({ text: "lavoro" });
  eq("the category by its name, case aside", (await X.generateEditorContent("suggest_category", note)).text, "Lavoro");
  answer({ text: "none" });
  eq("none is no match", (await X.generateEditorContent("suggest_category", note)).error, "no_category_match");

  // categories from the options win over the store's; with none, the model is not asked
  const before = llama.completions.length;
  eq(
    "no categories: no match, and no completion",
    await X.generateEditorContent("suggest_category", note, undefined, { categories: ["  "] }),
    {
      success: false,
      error: "no_category_match",
    }
  );
  eq("... the model was not asked", llama.completions.length, before);
  answer({ text: "Casa" });
  await X.generateEditorContent("suggest_category", note, undefined, { categories: ["Casa", "Altro"] });
  eq("options.categories win over the store's", lastCompletion().grammar, H.categoryGrammar(["Casa", "Altro"]));
}

console.log("cancel");
{
  await fresh();
  // before it starts: a cancel between the call and the run, and a run that began before a cancel
  const first = X.generateEditorContent("generate_title", "Una nota");
  await X.cancelCommand();
  eq("cancelled in the queue", await first, { success: false, error: "cancelled" });
  eq("... no completion call", llama.completions.length, 0);

  const generation = X.currentGeneration();
  await X.cancelCommand();
  eq(
    "started before a cancel (options.generation)",
    await X.generateEditorContent("generate_title", "Una nota", undefined, { generation }),
    {
      success: false,
      error: "cancelled",
    }
  );
  eq("... no completion call", llama.completions.length, 0);
  eq("... and nothing loaded for it", llama.inits.length, 0);

  // mid-answer
  answer({ text: "Un titolo molto lungo da scrivere" });
  const tokens = [];
  const run = X.generateEditorContent("generate_title", "Una nota", (token) => {
    tokens.push(token);
    if (tokens.length === 2) void X.cancelCommand();
  });
  const result = await run;
  eq("mid-answer: cancelled", { success: result.success, error: result.error }, { success: false, error: "cancelled" });
  eq("... stopCompletion called exactly once", llama.contexts[0].stopCalls, 1);
  eq("... the answer stopped after the token that cancelled", tokens.length, 2);
  eq("... the one completion ran", llama.completions.length, 1);
  eq("... with its timings", result.timings, TIMINGS);

  // the next one runs
  answer({ text: "Un altro titolo" });
  const after = await X.generateEditorContent("generate_title", "Una nota");
  eq("a run after a cancel goes on", { success: after.success, text: after.text }, { success: true, text: "Un altro titolo" });
}

console.log("one completion at a time");
{
  await fresh();
  let release;
  const hold = new Promise((resolve) => (release = resolve));
  answer({ text: "Primo titolo", hold }, { text: "Secondo titolo" });
  let resolved1 = false;
  const first = X.generateEditorContent("generate_title", "Una nota").then((r) => ((resolved1 = true), r));
  const second = X.generateEditorContent("generate_title", "Un'altra nota");
  await settle();
  eq("the second waits while the first runs", llama.completions.length, 1);
  eq("... the first is still under way", resolved1, false);
  release();
  const [a, b] = await Promise.all([first, second]);
  eq("the first answer", a.text, "Primo titolo");
  eq("the second answer", b.text, "Secondo titolo");
  eq("never two at once", llama.maxRunning, 1);
  const events = llama.events.filter((e) => e.startsWith("start") || e.startsWith("end"));
  eq("the second starts after the first ended", events, ["start 1", "end 1", "start 2", "end 2"]);
  eq("one model load for both", llama.inits.length, 1);

  // a help search queues behind an action too
  await fresh();
  let release2;
  const hold2 = new Promise((resolve) => (release2 = resolve));
  answer({ text: "Titolo", hold: hold2 }, { text: "[0]" });
  const action = X.generateEditorContent("generate_title", "Una nota");
  const search = X.searchHelpByIntent("domanda", [{ base: "k0", title: "Uno" }]);
  await settle();
  eq("help search waits for the action", llama.completions.length, 1);
  release2();
  await Promise.all([action, search]);
  eq("... and then runs, never alongside", [llama.maxRunning, llama.completions.length], [1, 2]);
}

console.log("idle release");
{
  await fresh();
  const clock = fakeClock();
  await X.generateEditorContent("generate_title", "Una nota");
  eq("a loaded model stays after a completion", releases(), 0);
  eq("... with one countdown running", clock.pending(), 1);
  await clock.advance(3 * 60 * 1000 - 1);
  eq("just before 3 minutes: not released", releases(), 0);
  await clock.advance(1);
  eq("3 minutes after the last completion: released once", releases(), 1);
  eq("... the status goes idle", X.getAIStatus(), "idle");
  eq("... and no context is kept", X.getContextInfo(), null);
  await clock.advance(10 * 60 * 1000);
  eq("... and not released again", releases(), 1);

  // each completion restarts the countdown
  await fresh();
  const clock2 = fakeClock();
  await X.generateEditorContent("generate_title", "Una nota");
  await clock2.advance(2 * 60 * 1000);
  await X.generateEditorContent("generate_title", "Un'altra nota");
  eq("the second completion reused the loaded model", llama.inits.length, 1);
  await clock2.advance(2 * 60 * 1000);
  eq("2 minutes after the last: still loaded", releases(), 0);
  await clock2.advance(60 * 1000);
  eq("3 minutes after the last: released once", releases(), 1);

  // a new action after the release loads again
  await X.generateEditorContent("generate_title", "Una nota");
  eq("an action after a release loads the model again", llama.inits.length, 2);

  // the background
  await fresh();
  const clock3 = fakeClock();
  await X.generateEditorContent("generate_title", "Una nota");
  eq("loaded, in the foreground", releases(), 0);
  appState.currentState = "background";
  for (const listener of appState.listeners) listener("background");
  await settle();
  eq("the app going to the background releases at once", releases(), 1);
  eq("... without waiting for the countdown", clock3.pending(), 0);

  // not under a running completion
  await fresh();
  const clock4 = fakeClock();
  let release;
  const hold = new Promise((resolve) => (release = resolve));
  answer({ text: "Un titolo", hold });
  const running = X.generateEditorContent("generate_title", "Una nota");
  await settle();
  eq("a completion is running", llama.running, 1);
  appState.currentState = "background";
  for (const listener of appState.listeners) listener("background");
  await settle();
  eq("the background during a completion releases nothing", releases(), 0);
  release();
  const result = await running;
  await settle();
  eq("the completion was not cut", { success: result.success, text: result.text }, { success: true, text: "Un titolo" });
  eq("after it, in the background: released at once", releases(), 1);
  eq("... with no countdown left", clock4.pending(), 0);
}

console.log("help search");
{
  await fresh();
  const catalog = [
    { base: "notes.create", title: "Creare una nota" },
    { base: "notes.delete", title: "Eliminare una nota" },
    { base: "cloud.sync", title: "Sincronizzare" },
  ];
  answer({ text: "[2,0,2,9]" });
  const keys = await X.searchHelpByIntent("  come sincronizzo?  ", catalog);
  const p = lastCompletion();
  eq("the keys of entries 2 and 0, once each, out of range left out", keys, ["cloud.sync", "notes.create"]);
  eq("the grammar is JSON_INT_ARRAY_GRAMMAR", p.grammar, C.JSON_INT_ARRAY_GRAMMAR);
  eq("n_predict is 48", p.n_predict, 48);
  eq("the whole params: the help prompt, the topics, the template, the stop words, the cooler sampling", p, {
    messages: [
      { role: "system", content: C.HELP_SEARCH_SYSTEM_PROMPT },
      {
        role: "user",
        content: "Topics:\n0. Creare una nota\n1. Eliminare una nota\n2. Sincronizzare\n\nQuestion: come sincronizzo?",
      },
    ],
    ...TEMPLATE,
    n_predict: 48,
    stop: STOP_WORDS,
    ...C.HELP_SEARCH_SAMPLING,
    grammar: C.JSON_INT_ARRAY_GRAMMAR,
  });
  eq("the sampling is FAITHFUL at temperature 0.1", C.HELP_SEARCH_SAMPLING, { ...FAITHFUL, temperature: 0.1 });

  const before = llama.completions.length;
  eq("an empty question: nothing", await X.searchHelpByIntent("  ", catalog), []);
  eq("an empty catalog: nothing", await X.searchHelpByIntent("domanda", []), []);
  eq("... the model was not asked", llama.completions.length, before);
  answer({ text: "1 e 0" });
  eq("a stray answer: its numbers", await X.searchHelpByIntent("domanda", catalog), ["notes.delete", "notes.create"]);
  answer({ text: "" });
  eq("no answer: nothing", await X.searchHelpByIntent("domanda", catalog), []);
}

console.log("switching model");
{
  await fresh();
  selectModel("qwen3.5-2b");
  await X.generateEditorContent("generate_title", "Una nota");
  eq("the 2B is loaded", X.getContextInfo() !== null && llama.inits.length === 1, true);
  const result = await X.generateEditorContent("generate_title", "Una nota", undefined, { modelId: "qwen3.5-0.8b" });
  ok("the 0.8B action answers", result.success === true, result);
  eq(
    "the 2B was released, then the 0.8B loaded",
    llama.events.filter((e) => e.startsWith("init") || e.startsWith("release")),
    ["init Qwen3.5-2B-Q4_K_M.gguf", "release Qwen3.5-2B-Q4_K_M.gguf", "init Qwen3.5-0.8B-Q4_K_M.gguf"]
  );
  eq("the 0.8B: its file, 4096 of context, pinned in RAM", llama.inits[1], {
    model: modelUri("qwen3.5-0.8b"),
    n_ctx: 4096,
    n_gpu_layers: 99,
    use_mlock: true,
  });
  eq("the 2B context was released once", llama.contexts[0].releaseCalls, 1);
  eq(
    "the 0.8B action ran on the 0.8B's prompt",
    lastCompletion().messages[0].content,
    C.getEditorSystemPrompt("generate_title", "it", "qwen3.5-0.8b")
  );
  await X.generateEditorContent("generate_title", "Una nota", undefined, { modelId: "qwen3.5-0.8b" });
  eq("the same model again: no new load", llama.inits.length, 2);
}

await fresh();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
