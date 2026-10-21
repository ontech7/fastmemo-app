// The on-device AI's pure parts: model id migration, what a stream shows, which answers are kept, and how dictation lands
// in a note. The model itself is not run here (the developer-only AI evaluation screen does that on a phone).
// Run: node scripts/ai.test.mjs
// It bundles src/libs/ai/{constants,helpers,blocks,longNote}.ts and src/utils/voiceTranscript.ts with esbuild (the store
// stubbed, and the model too: a long note's steps run against answers the tests script).

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const entry = join(os.tmpdir(), "ai.entry.ts");
const storeStub = join(os.tmpdir(), "ai.store-stub.ts");
const contextStub = join(os.tmpdir(), "ai.context-stub.ts");
const out = join(os.tmpdir(), "ai.bundle.mjs");

writeFileSync(
  storeStub,
  `export const store = { getState: () => ({ categories: { items: [{ name: "Casa al mare" }, { name: "Casa" }, { name: "Lavoro" }] } }) };\n`
);
// The model, for longNote.ts: each call is logged, `answer` scripts the reply, `cancel` is the user's cancel.
writeFileSync(
  contextStub,
  `
  let generation = 0;
  export const calls = [];
  const upper = (_action, content) => ({ success: true, text: content.toUpperCase() });
  let answer = upper;
  export function setAnswer(fn) { answer = fn ?? upper; }
  export function cancel() { generation++; }
  export const currentGeneration = () => generation;
  export const resolveLanguage = () => "it";
  export const selectedModelId = () => "qwen3.5-2b";
  export const getModelSpeed = () => ({ prefill: 100, generate: 10 });
  export async function generateEditorContent(action, content, onToken, options = {}) {
    const started = options.generation ?? generation;
    calls.push({ action, content, options });
    if (started !== generation) return { success: false, error: "cancelled" };
    const result = await answer(action, content);
    if (started !== generation) return { success: false, error: "cancelled" };
    if (result.text) onToken?.(result.text);
    return result;
  }
`
);
const stubContext = {
  name: "stub-context",
  setup(b) {
    // longNote's "./context" and the tests' handle on it: one module
    b.onResolve({ filter: /^(\.\/context|ai-context-stub)$/ }, (args) =>
      args.path === "ai-context-stub" || args.importer.endsWith("longNote.ts") ? { path: contextStub } : undefined
    );
  },
};
writeFileSync(
  entry,
  `
  export * as C from "@/libs/ai/constants";
  export * as H from "@/libs/ai/helpers";
  export * as V from "@/utils/voiceTranscript";
  export * as B from "@/libs/ai/blocks";
  export * as L from "@/libs/ai/longNote";
  export * as M from "ai-context-stub";
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
  plugins: [stubContext],
});

const { C, H, V, B, L, M } = await import(pathToFileURL(out).href);

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

ok(
  "translate: every language offered has a name in the prompt",
  C.TRANSLATE_LANGUAGES.every(({ code }) => !C.getEditorSystemPrompt("translate", code).includes("the same language")),
  C.TRANSLATE_LANGUAGES.filter(({ code }) => C.getEditorSystemPrompt("translate", code).includes("the same language"))
);
eq("translate: the target named in the prompt", C.getEditorSystemPrompt("translate", "ko").includes("Korean"), true);
eq(
  "translate: each language offered once",
  new Set(C.TRANSLATE_LANGUAGES.map((l) => l.code)).size,
  C.TRANSLATE_LANGUAGES.length
);

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

// --- category the AI named ---
eq("category: exact name wins over one containing it", H.findCategoryByName("Casa")?.name, "Casa");
eq("category: case-insensitive", H.findCategoryByName("lavoro")?.name, "Lavoro");
eq("category: containing as a fallback", H.findCategoryByName("mare")?.name, "Casa al mare");

// --- category grammar ---
eq("grammar: names then none", H.categoryGrammar(["Lavoro", "Casa"]), 'root ::= "Lavoro" | "Casa" | "none"');
eq(
  "grammar: quotes and backslashes escaped",
  H.categoryGrammar(['Il "mio"', "a\\b"]),
  'root ::= "Il \\"mio\\"" | "a\\\\b" | "none"'
);
eq("grammar: blank and repeated names dropped", H.categoryGrammar(["Casa", " ", "Casa"]), 'root ::= "Casa" | "none"');

// --- dictation into a note ---
eq("plain text: line breaks", V.voiceTextToHtml("a\nb"), " a<br>b");
eq("plain text: escaped", V.voiceTextToHtml("1 < 2 & 3", { leadingSpace: false }), "1 &lt; 2 &amp; 3");
eq(
  "dashes become a list",
  V.voiceTextToHtml("Per sabato:\n- bibite\n- torta\nPoi gli inviti.", { leadingSpace: false, lists: true }),
  "Per sabato:<ul><li>bibite</li><li>torta</li></ul>Poi gli inviti."
);
eq(
  "blank lines around a list dropped",
  V.voiceTextToHtml("Intro\n\n- a\n- b\n\nOutro", { leadingSpace: false, lists: true }),
  "Intro<ul><li>a</li><li>b</li></ul>Outro"
);
eq("a list first: no leading space", V.voiceTextToHtml("- a\n- b", { lists: true }), "<ul><li>a</li><li>b</li></ul>");
eq("list items escaped", V.voiceTextToHtml("- <b>", { leadingSpace: false, lists: true }), "<ul><li>&lt;b&gt;</li></ul>");
eq("typed dashes stay text without lists (quick notes)", V.voiceTextToHtml("- a\n- b", { leadingSpace: false }), "- a<br>- b");
eq("paragraphs kept", V.voiceTextToHtml("A\n\nB", { leadingSpace: false }), "A<br><br>B");
eq(
  "a dash inside a line is not a list",
  V.voiceTextToHtml("Roma - Milano", { leadingSpace: false, lists: true }),
  "Roma - Milano"
);

eq("lines: bullets and dashes dropped", V.voiceTextToLines("• Latte\n- Pane\n\n  Uova "), ["Latte", "Pane", "Uova"]);
eq("lines: plain lines kept", V.voiceTextToLines("Chiamare Marco\nPrenotare"), ["Chiamare Marco", "Prenotare"]);

// --- long notes: blocks (spec §7.5) ---
const units = (html) => B.splitNoteBlocks(html).filter((s) => s.kind === "unit");
const NOTES = [
  "",
  "Just one line",
  "First line<div>Second</div><div><br></div><div>Third <b>bold</b> &amp; more</div>",
  "<h1>Title</h1><div>Para</div><ul><li>one</li><li>two <i>it</i></li></ul><ol><li>a<ul><li>nested</li></ul></li></ol>",
  '<div style="text-align: center;">Centered</div><pre>code &lt;x&gt;</pre><hr><div><img src="data:image/jpeg;base64,AAA=" alt="a > b"></div>',
  '<div>Text with an image <img src="x.png"> inside</div><table><tr><td>cell</td></tr></table>',
  "<div>unclosed <b>bold<div>broken",
  "<p>Old</p><p>paragraphs</p><blockquote>quote<div>inner</div></blockquote>",
  "<!-- comment --><div>after a comment</div></div>stray close",
  "Dictated line one<br>line two<br><br>line four<div>Next <b>a<br>b</b> c</div>",
  "<div>&#99999999; &#x1F600; &amp;</div>",
];
for (const html of NOTES)
  eq(`blocks: round trip ${JSON.stringify(html.slice(0, 30))}`, B.joinNoteBlocks(B.splitNoteBlocks(html)), html);
eq(
  "blocks: paragraphs, the unwrapped first line, entities",
  units(NOTES[2]).map((u) => u.text),
  ["First line", "Second", "Third bold & more"]
);
eq(
  "blocks: a heading, a paragraph and every list item; a nested list's items too",
  units(NOTES[3]).map((u) => [u.tag, u.text]),
  [
    ["h1", "Title"],
    ["div", "Para"],
    ["li", "one"],
    ["li", "two it"],
    ["", "a"],
    ["li", "nested"],
  ]
);
eq(
  "blocks: code, rules and images are not text to rewrite",
  units(NOTES[4]).map((u) => u.text),
  ["Centered"]
);
eq(
  "blocks: the text around an image is rewritten, the image kept; tables kept",
  units(NOTES[5]).map((u) => u.text),
  ["Text with an image ", " inside"]
);
eq(
  "blocks: lines joined by <br> (dictation, pasted text) are a unit each; not one inside bold",
  units(NOTES[9]).map((u) => u.text),
  ["Dictated line one", "line two", "line four", "Next a\nb c"]
);
{
  const segments = B.splitNoteBlocks(NOTES[9]);
  const i = segments.findIndex((s) => s.kind === "unit" && s.text === "line two");
  eq(
    "blocks: one line rewritten, the line breaks around it kept",
    B.joinNoteBlocks(segments, new Map([[i, "LINE 2"]])),
    NOTES[9].replace("line two", "LINE 2")
  );
}
eq(
  "blocks: an entity past Unicode stays as written",
  units(NOTES[10]).map((u) => u.text),
  ["&#99999999; 😀 &"]
);
eq(
  "blocks: nothing past broken markup is rewritten",
  units(NOTES[6]).map((u) => u.text),
  []
);
{
  const segments = B.splitNoteBlocks(NOTES[3]);
  const i = segments.findIndex((s) => s.kind === "unit" && s.text === "Para");
  const j = segments.findIndex((s) => s.kind === "unit" && s.text === "two it");
  eq(
    "blocks: a rewritten unit goes back in its place, escaped, with its line breaks",
    B.joinNoteBlocks(segments, new Map([[i, "New <para>\nline"]])),
    "<h1>Title</h1><div>New &lt;para&gt;<br>line</div><ul><li>one</li><li>two <i>it</i></li></ul><ol><li>a<ul><li>nested</li></ul></li></ol>"
  );
  eq(
    "blocks: a unit given back unchanged keeps its formatting",
    B.joinNoteBlocks(segments, new Map([[j, "two  it "]])),
    NOTES[3]
  );
  eq("blocks: an empty answer leaves the unit as it was", B.joinNoteBlocks(segments, new Map([[i, "  "]])), NOTES[3]);
  eq(
    "blocks: alignment kept on a rewritten paragraph",
    B.joinNoteBlocks(B.splitNoteBlocks(NOTES[4]), new Map([[0, "Middle"]])).startsWith(
      '<div style="text-align: center;">Middle</div>'
    ),
    true
  );
}
eq("blocks: text of the units, one per line", B.blocksText(B.splitNoteBlocks(NOTES[3])), "Title\nPara\none\ntwo it\na\nnested");
{
  const note = "<div>Body</div><ul><li>x</li></ul>";
  const once = B.withSummary(note, "Riassunto", "Short & sweet.\nTwo lines");
  eq(
    "summary: on top under a marked bold label, the note below as it was",
    once,
    '<div><b data-fm="summary">Riassunto</b></div><div>Short &amp; sweet.<br>Two lines</div><div><br></div>' + note
  );
  ok("summary: found at the top", B.hasSummary(once) && !B.hasSummary(note));
  eq(
    "summary: a new one replaces the one added before (in any language)",
    B.withSummary(once, "Summary", "Newer."),
    '<div><b data-fm="summary">Summary</b></div><div>Newer.</div><div><br></div>' + note
  );
  eq("summary: what a new summary reads leaves the old one out", B.withoutSummary(once), note);
  const edited = '<div><b data-fm="summary">Riassunto</b></div><div>Mine <i>too</i><div>nested</div> end</div><div>after</div>';
  eq("summary: one the user edited goes whole (nested markup too)", B.withoutSummary(edited), "<div>after</div>");
  for (const [name, html] of [
    [
      "a line the user started after the label (its mark copied by Enter)",
      '<div><b data-fm="summary">Riassunto</b></div><div><b data-fm="summary">mia riga</b></div><div>vecchio</div>',
    ],
    ["a bold line the user wrote", "<div><b>Riassunto</b></div><div>We agreed X.</div>"],
    ["a bold label before a list", "<div><b>Summary</b></div><ul><li>first</li><li>second</li></ul>"],
    [
      "a marked label below an image",
      '<div><img src="x"></div><div><b data-fm="summary">Riassunto</b></div><div>mio testo</div>',
    ],
    ["a marked label with no summary after it", '<div><b data-fm="summary">Riassunto</b></div>'],
  ]) {
    eq(`summary: not one: ${name}`, B.withoutSummary(html), html);
  }
}
eq("tokens: about 3.5 characters each", B.estimateTokens("a".repeat(35)), 10);
eq("tokens: a CJK character is one", B.estimateTokens("日本語"), 3);
eq("chunks: grouped up to the budget", B.chunkTexts(["a".repeat(35), "b".repeat(35), "c".repeat(35)], 20), [
  "a".repeat(35) + "\n" + "b".repeat(35),
  "c".repeat(35),
]);
eq("chunks: a text over the budget is split first", B.chunkTexts(["a".repeat(70), "b"], 10), [
  "a".repeat(35),
  "a".repeat(35),
  "b",
]);
{
  const text = "Prima frase. Seconda frase, un po' più lunga! Terza? " + "parola ".repeat(60) + "fine.";
  const pieces = B.splitText(text, 12);
  eq("split: joining the pieces gives the text back", pieces.join(""), text);
  ok(
    "split: every piece within about the budget",
    pieces.every((p) => B.estimateTokens(p) <= 13),
    pieces
  );
  eq("split: cut after a sentence", pieces[0], "Prima frase. ");
  eq("split: short text, one piece", B.splitText("Breve.", 12), ["Breve."]);
  eq("split: a script without spaces still cut", B.splitText("日本語".repeat(10), 8).join(""), "日本語".repeat(10));
  const numbers =
    "Il totale ammonta a 2.300 euro più IVA, vedi https://docs.example.com/path e poi " + "parola ".repeat(40) + "fine.";
  ok(
    "split: never after a number's or a URL's dot",
    B.splitText(numbers, 12).every((piece) => !/\d\.$|example\.$/.test(piece.trimEnd())),
    B.splitText(numbers, 12)
  );
  const emoji = "漢字😀".repeat(400);
  const halves = B.splitText(emoji, 50);
  eq(
    "split: an emoji is never cut in half",
    [halves.join("") === emoji, halves.some((p) => /^[\udc00-\udfff]|[\ud800-\udbff]$/.test(p))],
    [true, false]
  );
}

// --- what's left of an answer cut off ---
eq("cut answer: up to the last full sentence", B.completeSentences("Uno. Due! Tre e poi qu"), "Uno. Due!");
eq("cut answer: CJK punctuation", B.completeSentences("東京に行った。京都も"), "東京に行った。");
eq("cut answer: no sentence ended: nothing", B.completeSentences("Solo un pezzo"), "");
eq("cut answer: a number isn't a sentence end", B.completeSentences("Spesa 2.300 euro. Marco paga 1.200"), "Spesa 2.300 euro.");
eq("cut answer: ...nor a decimal", B.completeSentences("Revenue grew 3.5% and the dr"), "");
eq(
  "cut answer: a list keeps its whole lines",
  B.completeSentences("- Budget 38k\n- Riunione il 14\n- Marco pa"),
  "- Budget 38k\n- Riunione il 14"
);

// --- a grammar fix keeps the words ---
ok(
  "grammar: a fix passes",
  H.isPlausibleRewrite("fix_grammar", "Their going to the store tomorow", "They're going to the store tomorrow")
);
ok(
  "grammar: a heavy fix of a short line passes",
  H.isPlausibleRewrite("fix_grammar", "Me and him has decided", "He and I have decided")
);
for (const [typo, fixed] of [
  ["Telefonre a mamam", "Telefonare a mamma"],
  ["Chiamre dentsta", "Chiamare dentista"],
  ["Riunone con Marcco", "Riunione con Marco"],
  ["recieve teh pakage", "receive the package"],
  ["He dont knows", "He doesn't know"],
]) {
  ok(`grammar: typos fixed on a short line pass (${typo})`, H.isPlausibleRewrite("fix_grammar", typo, fixed));
}
ok(
  "grammar: a line turned into another language is thrown away",
  !H.isPlausibleRewrite("fix_grammar", "Prima del trasloco", "Antes del traslado")
);
ok(
  "grammar: text without spaces isn't checked by words",
  H.isPlausibleRewrite("fix_grammar", "明日は雨がふるでしょう", "明日は雨が降るでしょう")
);
ok("grammar: translation isn't checked by words", H.isPlausibleRewrite("translate", "Prima del trasloco", "Before the move"));

// --- what the model adds around an answer ---
eq("clean: quotes around a title", H.cleanAnswer("generate_title", "note", '"Spesa"'), "Spesa");
eq("clean: a label before a title", H.cleanAnswer("generate_title", "note", "Titolo: Spesa"), "Spesa");
eq("clean: a label before a summary", H.cleanAnswer("summarize", "note", "Summary: Short."), "Short.");
eq(
  "clean: a line that starts with a quote stays",
  H.cleanAnswer("fix_grammar", '"Dune" by Frank Herbert', '"Dune" by Frank Herbert'),
  '"Dune" by Frank Herbert'
);
eq("clean: ...or ends with one", H.cleanAnswer("fix_grammar", 'He said "call me"', 'He said "call me"'), 'He said "call me"');
eq("clean: a quoted input stays quoted", H.cleanAnswer("translate", '"Ciao"', '"Hello"'), '"Hello"');
eq(
  "clean: no label stripped from a rewrite",
  H.cleanAnswer("fix_grammar", "Title: The Hobbit", "Title: The Hobbit"),
  "Title: The Hobbit"
);
eq("clean: ...nor from dictation", H.cleanAnswer("clean_transcript", "titolo: ciao", "Titolo: ciao"), "Titolo: ciao");
eq("clean: bold around the answer", H.cleanAnswer("summarize", "x", "**Short.**"), "Short.");
eq(
  "clean: dialogue keeps its quotes",
  H.cleanAnswer("translate", '"Hello," he said, "see you."', "«Ciao», disse, «a domani.»"),
  "«Ciao», disse, «a domani.»"
);
eq("clean: ...in Japanese too", H.cleanAnswer("translate", "x", "「はい」と「いいえ」"), "「はい」と「いいえ」");
eq(
  "clean: a quoted input stays quoted in new quotes",
  H.cleanAnswer("translate", '"Carpe diem"', "«Cogli l'attimo»"),
  "«Cogli l'attimo»"
);
eq(
  "clean: a closing quote the fix added stays",
  H.cleanAnswer("fix_grammar", '"ciao" disse lui, "vieni qui', '"Ciao" disse lui, "vieni qui"'),
  '"Ciao" disse lui, "vieni qui"'
);
eq(
  "clean: two quoted words in a title stay",
  H.cleanAnswer("generate_title", "note", '"Meeting" and "notes"'),
  '"Meeting" and "notes"'
);
eq(
  "clean: a title's label goes even if the note starts with one",
  H.cleanAnswer("generate_title", "Titolo: bozza", "Titolo: Relazione Q3"),
  "Relazione Q3"
);

// --- long notes: one step per paragraph (or part), against the stub model ---
const run = async (fn) => {
  M.calls.length = 0;
  const progress = [];
  const texts = [];
  const result = await fn({ onProgress: (p) => progress.push(`${p.done}/${p.total}`), onText: (t) => texts.push(t) });
  M.setAnswer();
  return { result, progress, texts, calls: M.calls.map((c) => [c.action, c.content]), options: M.calls.map((c) => c.options) };
};
{
  const note = "<h1>Titolo</h1><div>uno <b>bold</b></div><ul><li>due</li></ul><pre>code</pre>";
  const r = await run((h) => L.rewriteNote("fix_grammar", note, h));
  eq("long: each unit rewritten in its place, the rest kept", r.result, {
    success: true,
    html: "<h1>TITOLO</h1><div>UNO BOLD</div><ul><li>DUE</li></ul><pre>code</pre>",
    text: "TITOLO\nUNO BOLD\nDUE",
  });
  eq("long: one call per unit, in order", r.calls, [
    ["fix_grammar", "Titolo"],
    ["fix_grammar", "uno bold"],
    ["fix_grammar", "due"],
  ]);
  eq("long: progress before each step and at the end", r.progress, ["0/3", "1/3", "2/3", "3/3"]);
  eq("long: the text shown grows step by step", r.texts.at(-1), "TITOLO\n\nUNO BOLD\n\nDUE");
  ok(
    "long: every call has the language and the run's generation",
    r.options.every((o) => o.lang === "it" && o.modelId === "qwen3.5-2b" && o.generation === r.options[0].generation),
    r.options
  );
  const again = await run((h) => L.rewriteNote("fix_grammar", note, h));
  eq("long: run again, every step from the cache", [again.calls.length, again.result.html], [0, r.result.html]);
  const english = await run((h) => L.rewriteNote("fix_grammar", note, h, { lang: "en" }));
  eq("long: another language is not a cache hit", english.calls.length, 3);
}
{
  M.setAnswer((_a, c) =>
    c === "secondo x" ? { success: false, error: "implausible_output" } : { success: true, text: c.toUpperCase() }
  );
  const r = await run((h) => L.rewriteNote("translate", "<div>primo</div><div>secondo <i>x</i></div>", h));
  eq(
    "long: a unit the guard threw away stays as it was (formatting too)",
    r.result.html,
    "<div>PRIMO</div><div>secondo <i>x</i></div>"
  );
  const again = await run((h) => L.rewriteNote("translate", "<div>primo</div><div>secondo <i>x</i></div>", h));
  eq("long: ...and is asked again next time (the rest from the cache)", again.calls, [["translate", "secondo x"]]);
  L.clearLongNoteCache();
  const fresh = await run((h) => L.rewriteNote("translate", "<div>primo</div><div>secondo <i>x</i></div>", h));
  eq("long: a result turned down is forgotten: the next run asks the model", fresh.calls.length, 2);
}
{
  M.setAnswer((_a, c) => ({ success: true, text: c }));
  const r = await run((h) => L.rewriteNote("translate", "<div>già</div><div>fatto</div>", h));
  eq("long: nothing changed anywhere: no improvement", r.result, { success: false, error: "implausible_output" });
}
{
  M.setAnswer((_a, c) => (c === "b2" ? { success: false, error: "No response" } : { success: true, text: c.toUpperCase() }));
  const r = await run((h) => L.rewriteNote("fix_grammar", "<div>b1</div><div>b2</div><div>b3</div>", h));
  eq(
    "long: an error stops the run, nothing applied",
    [r.result, r.calls.length],
    [{ success: false, error: "No response" }, 2]
  );
  M.setAnswer((_a, c) => (c === "t2 x" ? { success: false, error: "too_long" } : { success: true, text: c.toUpperCase() }));
  const big = await run((h) => L.rewriteNote("fix_grammar", "<div>t1</div><div>t2 <b>x</b></div><div>t3</div>", h));
  eq(
    "long: a line that doesn't fit stays as it was, the rest goes on",
    big.result.html,
    "<div>T1</div><div>t2 <b>x</b></div><div>T3</div>"
  );
  M.setAnswer(() => ({ success: false, error: "too_long" }));
  const nothingFits = await run((h) => L.rewriteNote("fix_grammar", "<div>u1</div><div>u2</div>", h));
  eq('long: no line fits: too long, not "no improvement"', nothingFits.result.error, "too_long");
}
{
  M.setAnswer((_a, c) => {
    if (c === "c1") M.cancel();
    return { success: true, text: c.toUpperCase() };
  });
  const r = await run((h) => L.rewriteNote("fix_grammar", "<div>c1</div><div>c2</div><div>c3</div>", h));
  eq("long: a cancel during a step stops it and the steps after", [r.result.error, r.calls.length], ["cancelled", 1]);
  const after = await run((h) => L.rewriteNote("fix_grammar", "<div>c1</div><div>c2</div>", h));
  ok("long: a run after a cancel goes", after.result.success, after.result);
}
{
  const long = "Questo paragrafo è abbastanza lungo da valere la pena di accorciarlo, con parecchie parole dentro di sé.";
  const r = await run((h) =>
    L.rewriteNote("shorten", `<h1>Un titolo</h1><div>Corto.</div><div>${long}</div><ul><li>${long}</li></ul>`, h)
  );
  eq("long: shortening runs on long paragraphs only (not headings, list items, short lines)", r.calls, [["shorten", long]]);
  const summed = B.withSummary("<div>ciao</div>", "Riassunto", "saluto");
  const translated = await run((h) => L.rewriteNote("translate", summed, h));
  eq(
    "long: a summary's label is never rewritten (it keeps its mark)",
    translated.calls.map((c) => c[1]),
    ["saluto", "ciao"]
  );
  ok("long: ...so it's still the summary", B.hasSummary(translated.result.html), translated.result.html);
  const none = await run((h) => L.rewriteNote("shorten", "<div>Corto.</div><div>Anche questo.</div>", h));
  eq("long: nothing long enough to shorten: no call", [none.result.error, none.calls.length], ["implausible_output", 0]);
  const paragraph = Array.from(
    { length: 30 },
    (_, i) => `Frase numero ${i + 1} di un paragrafo molto lungo, scritto tutto di fila senza andare a capo.`
  ).join(" ");
  const pieces = await run((h) => L.rewriteNote("fix_grammar", `<div>${paragraph}</div>`, h));
  ok("long: a long paragraph a few sentences at a time", pieces.calls.length > 1, pieces.calls.length);
  eq("long: ...joined back as one paragraph", pieces.result.html, `<div>${paragraph.toUpperCase()}</div>`);
  eq("long: ...progress counts the pieces", pieces.progress.at(-1), `${pieces.calls.length}/${pieces.calls.length}`);
}
{
  const r = await run((h) => L.summarizeNote("<div>Uno.</div><div>Due.</div>", "Spesa", h));
  eq(
    "summary: a short note in one call, the title first",
    [r.result, r.calls, r.progress],
    [{ success: true, text: "SPESA\nUNO.\nDUE." }, [["summarize", "Spesa\nUno.\nDue."]], ["0/1", "1/1"]]
  );
  const old = B.withSummary("<div>Corpo.</div>", "Riassunto", "Vecchio.");
  const again = await run((h) => L.summarizeNote(old, "", h));
  eq("summary: the one added before is not read again", again.calls, [["summarize", "Corpo."]]);
  const empty = await run((h) => L.summarizeNote(B.withSummary("", "Riassunto", "Solo questo."), "", h));
  eq("summary: nothing but an old summary: no content", [empty.result.error, empty.calls.length], ["no_content", 0]);
}
{
  const para = (i) => `<div>${`Paragrafo ${i} `.repeat(150)}</div>`;
  const note = [1, 2, 3, 4, 5, 6].map(para).join("");
  M.setAnswer((action, c) => ({ success: true, text: action === "summarize_part" ? `parte(${c.length})` : `finale: ${c}` }));
  const r = await run((h) => L.summarizeNote(note, "T", h));
  eq(
    "summary: a long note in parts, then merged",
    r.calls.map((c) => c[0]),
    ["summarize_part", "summarize_part", "summarize_part", "summarize"]
  );
  eq("summary: the merge reads the parts' summaries", r.calls.at(-1)[1], "T\nparte(3599)\nparte(3599)\nparte(3599)");
  eq("summary: progress counts the parts and the merge", r.progress, ["0/4", "1/4", "2/4", "3/4", "4/4"]);
  M.setAnswer((action, c) => ({ success: true, text: action === "summarize_part" ? `parte(${c.length})` : `finale: ${c}` }));
  const again = await run((h) => L.summarizeNote(note, "T", h));
  eq(
    "summary: run again, only the merge runs (the parts are cached)",
    again.calls.map((c) => c[0]),
    ["summarize"]
  );
  M.setAnswer((action) =>
    action === "summarize_part" ? { success: false, error: "No response" } : { success: true, text: "x" }
  );
  const failed = await run((h) => L.summarizeNote(note.replace(/Paragrafo/g, "Capitolo"), "T", h));
  eq("summary: a part that fails stops it", [failed.result.error, failed.calls.length], ["No response", 1]);
}
{
  // the stub model reads 100 tokens/s and writes 10: ~3000 tokens of text
  const note = `<div>${"parola ".repeat(1500)}</div>`;
  eq("too long: rewrites past the limit, a summary not", L.tooLongForAI(note), ["fix_grammar", "translate"]);
  eq("too long: a short note, nothing", L.tooLongForAI("<div>Breve.</div>"), []);
  ok(
    "estimate: grows with the note",
    L.estimateSeconds("fix_grammar", note) > L.estimateSeconds("fix_grammar", "<div>Breve.</div>")
  );
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
