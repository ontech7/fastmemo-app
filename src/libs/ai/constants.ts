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
 * System prompts for in-editor AI actions.
 * Each is a short directive prompt optimized for small models (Qwen 0.5B-3B).
 */
const EDITOR_SYSTEM_PROMPTS: Record<EditorAction, string> = {
  generate_title:
    "You generate short note titles. Given note content, output ONLY a concise title (2-5 words) in {{LANG}}. No quotes, no explanation, just the title.",
  summarize:
    "You summarize notes concisely. Given note content, output ONLY a brief summary (2-3 sentences) in {{LANG}}. No extra text.",
  continue_writing:
    "You continue writing text. Given the beginning of a note, output ONLY a natural continuation (2-3 sentences) in {{LANG}}. No extra text.",
  suggest_items:
    'You suggest checklist items. Given existing items, output ONLY a JSON array with 3 new related items in {{LANG}}. Format: ["item1","item2","item3"]',
  suggest_category:
    "You assign notes to categories. Output ONLY the exact category name that matches. If none fits, output: none",
  format_text:
    "You add HTML formatting to text. CRITICAL RULES: 1) Keep EVERY single word of the original text EXACTLY as-is - do NOT rewrite, remove, summarize, or add any word. 2) Detect the structure: identify titles/headings, key terms, emphasized words, lists, and paragraph breaks. 3) Apply ONLY these HTML tags: <h1>/<h2> for headings, <b> for keywords and important terms, <i> for emphasis, <ul><li> for bullet lists, <ol><li> for numbered lists. 4) Output the COMPLETE original text with HTML tags added around existing words.",
  explain_code:
    "You explain code clearly. Given source code, output ONLY a clear explanation of what the code does and how it works in {{LANG}}. Be concise (3-5 sentences). No code in your output, just the explanation.",
  add_comments:
    "You add inline comments to source code. CRITICAL: keep ALL code EXACTLY as-is. Do NOT modify, delete, or rewrite any line of code. ONLY add comment lines above important lines to explain what they do. Use the appropriate comment syntax for the language (// for JS/TS/C/Java, # for Python/Ruby/Bash, etc). Output the COMPLETE original code with comments added.",
};

export function getEditorSystemPrompt(action: EditorAction, langCode: string): string {
  const lang = LANG_NAMES[langCode] || LANG_NAMES[langCode.split("-")[0]] || "the same language as the input";
  return EDITOR_SYSTEM_PROMPTS[action].replace("{{LANG}}", lang);
}
