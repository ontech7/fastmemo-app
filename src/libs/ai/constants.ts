import type { AIModelId, AIModelInfo, EditorAction } from "./types";

const GB = 1024 * 1024 * 1024;

export const AI_MODELS: Record<AIModelId, AIModelInfo> = {
  "qwen-0.5b": {
    id: "qwen-0.5b",
    name: "Qwen2.5 0.5B",
    fileName: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~400 MB",
    description: "ai.model_light",
    minRamBytes: 3 * GB,
    contextSize: 2048,
  },
  "qwen-1.5b": {
    id: "qwen-1.5b",
    name: "Qwen2.5 1.5B",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.0 GB",
    description: "ai.model_powerful",
    minRamBytes: 4 * GB,
    contextSize: 4096,
  },
  "qwen-3b": {
    id: "qwen-3b",
    name: "Qwen2.5 3B",
    fileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.9 GB",
    description: "ai.model_advanced",
    minRamBytes: 6 * GB,
    contextSize: 8192,
  },
  "qwen-7b": {
    id: "qwen-7b",
    name: "Qwen2.5 7B",
    fileName: "qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
    sizeLabel: "~4.7 GB",
    description: "ai.model_pro",
    minRamBytes: 8 * GB,
    contextSize: 16384,
    parts: [
      {
        fileName: "qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf",
        url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf",
      },
    ],
  },
};

export const DEFAULT_MODEL_ID: AIModelId = "qwen-0.5b";

/** Numeric ordering for model size comparison */
export const MODEL_SIZE_ORDER: Record<AIModelId, number> = {
  "qwen-0.5b": 0,
  "qwen-1.5b": 1,
  "qwen-3b": 2,
  "qwen-7b": 3,
};

/** Returns the short display label for a model (e.g. "7B") */
export const MODEL_SHORT_LABEL: Record<AIModelId, string> = {
  "qwen-0.5b": "0.5B",
  "qwen-1.5b": "1.5B",
  "qwen-3b": "3B",
  "qwen-7b": "7B",
};

/** Check if the selected model meets the minimum requirement */
export function isModelSufficient(currentModel: AIModelId, minModel: AIModelId): boolean {
  return MODEL_SIZE_ORDER[currentModel] >= MODEL_SIZE_ORDER[minModel];
}

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
 * Each is a short directive prompt optimized for small models (Qwen 0.5B-3B).
 */
const EDITOR_SYSTEM_PROMPTS: Record<EditorAction, string> = {
  generate_title:
    "You generate short note titles. Given note content, output ONLY a concise title (2-5 words) in {{LANG}}. No quotes, no explanation, just the title.",
  summarize:
    "You summarize notes concisely. Given note content, output ONLY a brief summary (2-3 sentences) in {{LANG}}. No extra text.",
  suggest_items:
    'You suggest checklist items. Given existing items, output ONLY a JSON array with 3 new related items in {{LANG}}. Format: ["item1","item2","item3"]',
  suggest_category:
    "You assign notes to categories based on their title and content. Either alone is enough to decide. Output ONLY the exact category name from the list that matches. If none fits, output: none",
  explain_code:
    "You explain code clearly. Given source code, output ONLY a clear explanation of what the code does and how it works in {{LANG}}. Be concise (3-5 sentences). No code in your output, just the explanation.",
  add_comments:
    "You add inline comments to source code. CRITICAL: keep ALL code EXACTLY as-is. Do NOT modify, delete, or rewrite any line of code. ONLY add comment lines above important lines to explain what they do. Use the appropriate comment syntax for the language (// for JS/TS/C/Java, # for Python/Ruby/Bash, etc). Output the COMPLETE original code with comments added.",
  fix_grammar:
    "You correct spelling, grammar and punctuation. Output ONLY the corrected text in the SAME language as the input, preserving the original meaning and wording as much as possible. No explanation, no quotes.",
  shorten:
    "You make text more concise. Output ONLY a shorter version in the SAME language as the input, keeping the key information. No explanation, no quotes.",
  translate: "You translate text into {{LANG}}. Output ONLY the translation, nothing else. No quotes, no explanation.",
  clean_transcript:
    "You clean up dictated text. Add correct punctuation and capitalization and fix obvious transcription mistakes, keeping the original wording, meaning and language. Output ONLY the cleaned text as plain text. No explanation, no quotes.",
};

export function getEditorSystemPrompt(action: EditorAction, langCode: string): string {
  const lang = LANG_NAMES[langCode] || LANG_NAMES[langCode.split("-")[0]] || "the same language as the input";
  return EDITOR_SYSTEM_PROMPTS[action].replace("{{LANG}}", lang);
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
