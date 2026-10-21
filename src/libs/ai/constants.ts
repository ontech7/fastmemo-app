import type { AIModelId, AIModelInfo, EditorAction } from "./types";

const GB = 1024 * 1024 * 1024;

/** A file of a Hugging Face repo at a fixed commit: an update of the repo can never change what users download. */
const hf = (repo: string, revision: string, file: string) => `https://huggingface.co/${repo}/resolve/${revision}/${file}`;

/**
 * Qwen3.5 Small, Q4_K_M GGUFs by Unsloth (Qwen publishes none). RAM gates sit under the phone's class: Android reports usable
 * RAM, a little less than the box says. The 4B isn't pinned in RAM: on a 6 GB phone it would leave too little.
 */
export const AI_MODELS: Record<AIModelId, AIModelInfo> = {
  "qwen3.5-0.8b": {
    id: "qwen3.5-0.8b",
    name: "Qwen3.5 0.8B",
    fileName: "Qwen3.5-0.8B-Q4_K_M.gguf",
    url: hf("unsloth/Qwen3.5-0.8B-GGUF", "6ab461498e2023f6e3c1baea90a8f0fe38ab64d0", "Qwen3.5-0.8B-Q4_K_M.gguf"),
    sizeBytes: 532_517_120,
    sizeLabel: "~530 MB",
    description: "ai.model_light",
    minRamBytes: 2.5 * GB,
    contextSize: 4096,
    useMlock: true,
  },
  "qwen3.5-2b": {
    id: "qwen3.5-2b",
    name: "Qwen3.5 2B",
    fileName: "Qwen3.5-2B-Q4_K_M.gguf",
    url: hf("unsloth/Qwen3.5-2B-GGUF", "f6d5376be1edb4d416d56da11e5397a961aca8ae", "Qwen3.5-2B-Q4_K_M.gguf"),
    sizeBytes: 1_280_835_840,
    sizeLabel: "~1.3 GB",
    description: "ai.model_powerful",
    minRamBytes: 3.2 * GB,
    contextSize: 8192,
    useMlock: true,
  },
  "qwen3.5-4b": {
    id: "qwen3.5-4b",
    name: "Qwen3.5 4B",
    fileName: "Qwen3.5-4B-Q4_K_M.gguf",
    url: hf("unsloth/Qwen3.5-4B-GGUF", "e87f176479d0855a907a41277aca2f8ee7a09523", "Qwen3.5-4B-Q4_K_M.gguf"),
    sizeBytes: 2_740_937_888,
    sizeLabel: "~2.7 GB",
    description: "ai.model_advanced",
    minRamBytes: 5 * GB,
    contextSize: 8192,
    useMlock: false,
  },
};

export const DEFAULT_MODEL_ID: AIModelId = "qwen3.5-0.8b";

/** Numeric ordering for model size comparison */
export const MODEL_SIZE_ORDER: Record<AIModelId, number> = {
  "qwen3.5-0.8b": 0,
  "qwen3.5-2b": 1,
  "qwen3.5-4b": 2,
};

/** Returns the short display label for a model (e.g. "4B") */
export const MODEL_SHORT_LABEL: Record<AIModelId, string> = {
  "qwen3.5-0.8b": "0.8B",
  "qwen3.5-2b": "2B",
  "qwen3.5-4b": "4B",
};

/** Check if the selected model meets the minimum requirement */
export function isModelSufficient(currentModel: AIModelId, minModel: AIModelId): boolean {
  return MODEL_SIZE_ORDER[currentModel] >= MODEL_SIZE_ORDER[minModel];
}

/**
 * The Qwen 2.5 models of earlier versions, to the tier that replaces each: a stored setting may still name one. There's no
 * 7B any more: the 4B does as well on note tasks.
 */
const LEGACY_MODEL_MAP: Record<string, AIModelId> = {
  "qwen-0.5b": "qwen3.5-0.8b",
  "qwen-1.5b": "qwen3.5-2b",
  "qwen-3b": "qwen3.5-4b",
  "qwen-7b": "qwen3.5-4b",
};

export const isLegacyModelId = (id: string | undefined): boolean => !!id && id in LEGACY_MODEL_MAP;

/** A stored model id as one of today's: itself, the tier replacing a legacy one, or the default. */
export function normalizeModelId(id: string | undefined): AIModelId {
  if (id && id in AI_MODELS) return id as AIModelId;
  return (id && LEGACY_MODEL_MAP[id]) || DEFAULT_MODEL_ID;
}

/** llama.rn sampling for one kind of task (the names are its own). */
export interface Sampling {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  penalty_repeat: number;
  penalty_present: number;
}

/**
 * Cold for anything that rewrites or labels: the right output repeats most of the input, so no repeat penalty (it pushed the
 * model to change words it should keep). Warmer, with a presence penalty, where it writes something new. Not greedy
 * (temperature 0): measured, it fixed nothing and sent the 0.8B into a loop until the token limit.
 */
const FAITHFUL: Sampling = { temperature: 0.2, top_p: 0.8, top_k: 20, min_p: 0, penalty_repeat: 1, penalty_present: 0 };
const GENERATIVE: Sampling = { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, penalty_repeat: 1, penalty_present: 1 };

export const ACTION_SAMPLING: Record<EditorAction, Sampling> = {
  clean_transcript: FAITHFUL,
  fix_grammar: FAITHFUL,
  translate: FAITHFUL,
  shorten: FAITHFUL,
  generate_title: FAITHFUL,
  suggest_category: FAITHFUL,
  transcript_to_items: FAITHFUL,
  summarize: GENERATIVE,
  summarize_part: GENERATIVE,
  suggest_items: GENERATIVE,
};

export const HELP_SEARCH_SAMPLING: Sampling = { ...FAITHFUL, temperature: 0.1 };

/** The most an action may write (transforms get room for the whole text). */
export const ACTION_MAX_TOKENS: Record<EditorAction, number> = {
  generate_title: 30,
  suggest_category: 30,
  suggest_items: 100,
  summarize: 200,
  summarize_part: 120,
  shorten: 200,
  fix_grammar: 800,
  translate: 800,
  clean_transcript: 800,
  transcript_to_items: 300,
};

/**
 * How long a rewrite may come out, as a share of the input's length: outside the range the model went off the rails
 * (dropped half the text, answered a question, looped), and the answer is discarded. Translation changes length the most
 * (Japanese is far shorter than Italian); shortening may cut a lot but never lengthen.
 */
export const REWRITE_LENGTH_RATIO: Partial<Record<EditorAction, [min: number, max: number]>> = {
  clean_transcript: [0.5, 1.6],
  fix_grammar: [0.5, 1.6],
  translate: [0.25, 4],
  shorten: [0.1, 1],
};

const LANG_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  de: "German",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  zh: "Chinese",
};

/**
 * GBNF grammar for JSON array of strings output (used by suggest_items).
 */
export const JSON_ARRAY_GRAMMAR = `
root   ::= "[" ws string ("," ws string)* "]" ws
string ::= "\\"" ([^"\\\\] | "\\\\" .)* "\\""
ws     ::= [ \\t\\n]*
`.trim();

/**
 * GBNF grammar for a JSON array of integers (used by the Help intent search,
 * which returns the indices of the matching help topics).
 */
export const JSON_INT_ARRAY_GRAMMAR = `
root ::= "[" ws (int (ws "," ws int)*)? ws "]" ws
int  ::= [0-9]+
ws   ::= [ \\t\\n]*
`.trim();

/**
 * System prompt for the Help intent search. The model only ever picks numbers
 * from a provided list, so it can map a free-form question to existing help
 * topics without being able to invent any.
 */
export const HELP_SEARCH_SYSTEM_PROMPT =
  "You are a help search assistant for a note-taking app. The user describes what they need in their own words, in any language. From the numbered list of help topics below, pick the ones that best answer the user's need. Output ONLY a JSON array of the topic numbers, most relevant first, at most 6 numbers. If nothing is relevant, output an empty array []. No explanation, no extra text.";

/**
 * System prompts for in-editor AI actions.
 * Each is a short directive prompt for small models (Qwen3.5 0.8B-4B).
 */
const EDITOR_SYSTEM_PROMPTS: Record<EditorAction, string> = {
  generate_title:
    "You generate short note titles. Given note content, output ONLY a concise title (2-5 words) in {{LANG}}. No quotes, no explanation, just the title.",
  summarize:
    "You summarize notes concisely. Given note content, output ONLY a brief summary (2-3 sentences) in {{LANG}}. No extra text.",
  summarize_part:
    "You summarize one part of a longer note. Output ONLY its key facts (who, what, numbers, dates, decisions) in 2-3 sentences in {{LANG}}. No extra text.",
  suggest_items:
    'You suggest checklist items. Given existing items, output ONLY a JSON array with 3 new related items in {{LANG}}. Format: ["item1","item2","item3"]',
  suggest_category:
    "You assign notes to categories based on their title and content. Either alone is enough to decide. Pick the category whose name best describes what the note is about (a recipe goes with cooking or recipes, a flight with travel, a meeting with work). Output ONLY the exact category name from the list. If none fits, output: none",
  fix_grammar:
    "You correct spelling, grammar and punctuation. Output ONLY the corrected text in the SAME language as the input, preserving the original meaning and wording as much as possible. No explanation, no quotes.",
  shorten:
    "You make text more concise. Output ONLY a shorter version in the SAME language as the input, keeping the key information. No explanation, no quotes.",
  translate: "You translate text into {{LANG}}. Output ONLY the translation, nothing else. No quotes, no explanation.",
  clean_transcript:
    'You clean up dictated text. Add punctuation and capitalization and fix obvious speech-recognition mistakes. Remove fillers and false starts (like "uhm", "ehm", "cioè", "I mean") only where they are clearly hesitations. Start a new paragraph when the topic changes. Only when the speaker lists four or more things of the same kind, write them as a list, one per line, each starting with "- ". Keep the speaker\'s own words, verb forms and tone, and the same language: do not rephrase, translate, summarize or add anything. The text may contain questions: never answer them, keep them as questions. Output ONLY the cleaned text, no quotes.',
  transcript_to_items:
    "You turn a dictated to-do list into checklist items. Output ONLY a JSON array of strings: one short item per task or thing to buy, in the order spoken, in the same language as the input. Keep the speaker's words without fillers, start each item with a capital letter, and never add an item that was not said.",
};

/**
 * Shorter prompts for the 0.8B where the full one asks too much of it: given the long dictation prompt (fillers,
 * paragraphs, lists) it gave the text back without even the punctuation, and the category examples made it answer the
 * travel one for everything.
 */
const SMALL_MODEL_PROMPTS: Partial<Record<EditorAction, string>> = {
  suggest_category:
    "You assign notes to categories based on their title and content. Either alone is enough to decide. Output ONLY the exact category name from the list that matches. If none fits, output: none",
  clean_transcript:
    "You clean up dictated text. Add correct punctuation and capitalization and fix obvious transcription mistakes, keeping the original wording, meaning and language. Output ONLY the cleaned text as plain text. No explanation, no quotes.",
};

export function getEditorSystemPrompt(action: EditorAction, langCode: string, modelId?: AIModelId): string {
  const lang = LANG_NAMES[langCode] || LANG_NAMES[langCode.split("-")[0]] || "the same language as the input";
  const prompt = (modelId === "qwen3.5-0.8b" && SMALL_MODEL_PROMPTS[action]) || EDITOR_SYSTEM_PROMPTS[action];
  return prompt.replace("{{LANG}}", lang);
}

/**
 * Max input characters for actions where only the gist matters. Capping the
 * input keeps prompt prefill (the dominant latency on small on-device models)
 * fast on long notes — a title or category only needs the opening of the note,
 * not its full body. Actions not listed here receive the full content.
 */
const MAX_INPUT_CHARS: Partial<Record<EditorAction, number>> = {
  generate_title: 800,
  suggest_category: 500,
};

/**
 * Trim content to the action's input cap, cutting on a word boundary so the
 * model never sees a chopped-off word. Returns the content unchanged when the
 * action has no cap or is already short enough.
 */
export function truncateForAction(action: EditorAction, content: string): string {
  const limit = MAX_INPUT_CHARS[action];
  if (!limit || content.length <= limit) return content;
  const slice = content.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * How fast each model reads (prefill) and writes, in tokens per second, as measured on a Pixel 10 Pro, CPU only (AI
 * evaluation, 2026-10). A device's own completions replace them as they run (`getModelSpeed`).
 */
export const MODEL_SPEED: Record<AIModelId, { prefill: number; generate: number }> = {
  "qwen3.5-0.8b": { prefill: 210, generate: 38 },
  "qwen3.5-2b": { prefill: 92, generate: 18 },
  "qwen3.5-4b": { prefill: 28, generate: 7 },
};

/**
 * The longest a long-note action may take, estimated before it starts: past it the action is off for that note (minutes
 * of waiting with the phone busy is no use). The progress shows meanwhile.
 */
export const LONG_NOTE_MAX_SECONDS = 300;

/**
 * A summary reads the note in parts of about this many tokens (one call each, then one that merges them). A summary of the
 * whole note at once is better than one merged from parts (AI evaluation, 2026-10), but a part is read before anything
 * shows: about 15 s on the 2B and 55 s on the 4B on the reference phone.
 */
export const SUMMARY_PART_TOKENS = 1500;

/** A rewrite takes a paragraph longer than this many tokens a few sentences at a time (room to write in, and progress). */
export const REWRITE_PIECE_TOKENS = 600;

/** Shortening runs on paragraphs of at least this many tokens (about 20 words): a short line stays as it is. */
export const SHORTEN_MIN_TOKENS = 30;
