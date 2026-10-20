// The on-device AI's pure parts: model id migration, what a stream shows, which answers are kept, and how dictation lands
// in a note. The model itself is not run here (the developer-only AI evaluation screen does that on a phone).
// Run: node scripts/ai.test.mjs
// It bundles src/libs/ai/{constants,helpers}.ts and src/utils/voiceTranscript.ts with esbuild (the store stubbed).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const entry = join(os.tmpdir(), "ai.entry.ts");
const storeStub = join(os.tmpdir(), "ai.store-stub.ts");
const out = join(os.tmpdir(), "ai.bundle.mjs");

writeFileSync(storeStub, "export const store = { getState: () => ({ categories: { items: [] } }) };\n");
writeFileSync(
  entry,
  `
  export * as C from "@/libs/ai/constants";
  export * as H from "@/libs/ai/helpers";
  export * as V from "@/utils/voiceTranscript";
`
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@/slicers/store": storeStub, "@": src },
});

const { C, H, V } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL ${name}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), actual);

// --- model ids ---
eq("qwen-0.5b -> 0.8B", C.normalizeModelId("qwen-0.5b"), "qwen3.5-0.8b");
eq("qwen-1.5b -> 2B", C.normalizeModelId("qwen-1.5b"), "qwen3.5-2b");
eq("qwen-3b -> 4B", C.normalizeModelId("qwen-3b"), "qwen3.5-4b");
eq("qwen-7b -> 4B", C.normalizeModelId("qwen-7b"), "qwen3.5-4b");
eq("a current id stays", C.normalizeModelId("qwen3.5-2b"), "qwen3.5-2b");
eq("unknown -> default", C.normalizeModelId("llama-9000"), C.DEFAULT_MODEL_ID);
eq("missing -> default", C.normalizeModelId(undefined), C.DEFAULT_MODEL_ID);
ok("legacy id detected", C.isLegacyModelId("qwen-7b") && !C.isLegacyModelId("qwen3.5-4b"));
ok(
  "every action has sampling and a token budget",
  Object.keys(C.ACTION_MAX_TOKENS).every((a) => C.ACTION_SAMPLING[a])
);
ok("4B is enough for a 2B action", C.isModelSufficient("qwen3.5-4b", "qwen3.5-2b"));
ok("0.8B is not enough for a 2B action", !C.isModelSufficient("qwen3.5-0.8b", "qwen3.5-2b"));

// --- reasoning blocks ---
eq("no block: unchanged", H.stripThinking("Hello"), "Hello");
eq("closed block removed", H.stripThinking("<think>hmm</think>\n\nHello"), "Hello");
eq("open block: nothing after it", H.stripThinking("Hi <think>still going"), "Hi");

// --- what a stream shows ---
eq("partial think tag hidden", H.visibleStreamText("<thi"), "");
eq("open think block hidden", H.visibleStreamText("<think>\nreasoning"), "");
eq("after the block", H.visibleStreamText("<think>x</think>\n\nCiao"), "Ciao");
eq("leading blank lines dropped", H.visibleStreamText("\n\nCiao"), "Ciao");
eq("plain text kept", H.visibleStreamText("Ciao mondo"), "Ciao mondo");

{
  const seen = [];
  const stream = H.createTextStream((t) => seen.push(t), 20);
  for (const token of ["Ciao", " ", "mondo"]) stream.push(token);
  await new Promise((r) => setTimeout(r, 40));
  eq("stream: one update for a burst of tokens", seen, ["Ciao mondo"]);
  stream.push("!");
  stream.stop();
  await new Promise((r) => setTimeout(r, 40));
  eq("stream: nothing after stop", seen, ["Ciao mondo"]);
}

// --- rewrites worth showing ---
const para = "Ieri sono andato al mare con i miei amici e ci siamo divertiti molto.";
ok("same length rewrite kept", H.isPlausibleRewrite("fix_grammar", para, para.replace("Ieri", "Ieri,")));
ok("empty rewrite dropped", !H.isPlausibleRewrite("fix_grammar", para, "  "));
ok("half the text lost: dropped", !H.isPlausibleRewrite("fix_grammar", para, "Ieri al mare."));
ok("a reply instead of a rewrite: dropped", !H.isPlausibleRewrite("clean_transcript", para, para + " " + para));
ok("think tag: dropped", !H.isPlausibleRewrite("translate", para, `<think>${para}</think>`));
ok("short text gets slack", H.isPlausibleRewrite("clean_transcript", "ok", "Ok."));
ok(
  "translation into Japanese may be far shorter",
  H.isPlausibleRewrite("translate", para, "昨日は友達と海に行ってとても楽しかった。")
);
ok("shorten never lengthens", !H.isPlausibleRewrite("shorten", para, para + " Davvero tanto, tantissimo, per ore."));
ok("shorten may cut a lot", H.isPlausibleRewrite("shorten", para, "Al mare con gli amici."));
ok("summaries are not length-checked", H.isPlausibleRewrite("summarize", para, "Mare."));

// --- suggested items ---
eq(
  "items: repeats of the list and of each other dropped",
  H.cleanSuggestedItems(["Carbone", "birra", " ", "Birra", "insalata"], ["Grigliata", "carbone", "pane"]),
  ["birra", "insalata"]
);
eq("items: trimmed", H.cleanSuggestedItems(["  latte "]), ["latte"]);

eq("partial JSON: completed strings only", H.completedJsonStrings('["Milk","Bre'), ["Milk"]);
eq("partial JSON: escapes decoded", H.completedJsonStrings('["Say \\"hi\\"","b"]'), ['Say "hi"', "b"]);
eq("partial JSON: nothing yet", H.completedJsonStrings("["), []);

// --- dictation into a note ---
eq("plain text: line breaks", V.voiceTextToHtml("a\nb"), " a<br>b");
eq("plain text: escaped", V.voiceTextToHtml("1 < 2 & 3", { leadingSpace: false }), "1 &lt; 2 &amp; 3");
eq(
  "dashes become a list",
  V.voiceTextToHtml("Per sabato:\n- bibite\n- torta\nPoi gli inviti.", { leadingSpace: false }),
  "Per sabato:<ul><li>bibite</li><li>torta</li></ul>Poi gli inviti."
);
eq(
  "blank lines around a list dropped",
  V.voiceTextToHtml("Intro\n\n- a\n- b\n\nOutro", { leadingSpace: false }),
  "Intro<ul><li>a</li><li>b</li></ul>Outro"
);
eq("a list first: no leading space", V.voiceTextToHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
eq("list items escaped", V.voiceTextToHtml("- <b>", { leadingSpace: false }), "<ul><li>&lt;b&gt;</li></ul>");
eq("paragraphs kept", V.voiceTextToHtml("A\n\nB", { leadingSpace: false }), "A<br><br>B");
eq("a dash inside a line is not a list", V.voiceTextToHtml("Roma - Milano", { leadingSpace: false }), "Roma - Milano");

eq("lines: bullets and dashes dropped", V.voiceTextToLines("• Latte\n- Pane\n\n  Uova "), ["Latte", "Pane", "Uova"]);
eq("lines: plain lines kept", V.voiceTextToLines("Chiamare Marco\nPrenotare"), ["Chiamare Marco", "Prenotare"]);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
