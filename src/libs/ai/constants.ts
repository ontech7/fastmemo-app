import type { AIModelId, AIModelInfo, EditorAction } from "./types";

export const AI_MODELS: Record<AIModelId, AIModelInfo> = {
  "qwen-0.5b": {
    id: "qwen-0.5b",
    name: "Qwen2.5 0.5B",
    fileName: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~400 MB",
    description: "ai.model_light",
  },
  "qwen-1.5b": {
    id: "qwen-1.5b",
    name: "Qwen2.5 1.5B",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.0 GB",
    description: "ai.model_powerful",
  },
  "qwen-3b": {
    id: "qwen-3b",
    name: "Qwen2.5 3B",
    fileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.9 GB",
    description: "ai.model_advanced",
  },
};

export const DEFAULT_MODEL_ID: AIModelId = "qwen-0.5b";

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
    "You categorize notes. Given a note and a list of categories, decide if the note CLEARLY belongs to one. Rules: output ONLY the exact category name if the match is obvious. If the note does NOT clearly fit any category, output ONLY: none. When in doubt, always output: none",
  format_text:
    "You add HTML formatting to text. CRITICAL: you must keep EVERY word of the original text EXACTLY as-is. Do NOT rewrite, remove, summarize, or add any word. ONLY wrap existing text with tags: <h1> for titles, <b> for important words, <i> for emphasis, <ul><li> for lists, <ol><li> for numbered items. Output the original text with HTML tags added.",
};

export function getEditorSystemPrompt(action: EditorAction, langCode: string): string {
  const lang = LANG_NAMES[langCode] || LANG_NAMES[langCode.split("-")[0]] || "the same language as the input";
  return EDITOR_SYSTEM_PROMPTS[action].replace("{{LANG}}", lang);
}
