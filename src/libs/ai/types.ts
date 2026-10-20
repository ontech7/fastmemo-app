export type AIModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export type AIModelId = "qwen3.5-0.8b" | "qwen3.5-2b" | "qwen3.5-4b";

export interface AIModelInfo {
  id: AIModelId;
  name: string;
  fileName: string;
  url: string;
  /** The file's exact size: a download of any other size is incomplete or wrong, and is deleted. */
  sizeBytes: number;
  sizeLabel: string;
  description: string;
  minRamBytes: number;
  contextSize: number;
  /** Pin the weights in RAM (faster, but a large model can be killed for it on a phone with little to spare). */
  useMlock: boolean;
  parts?: { fileName: string; url: string; sizeBytes: number }[];
}

export type EditorAction =
  | "generate_title"
  | "summarize"
  | "suggest_items"
  | "suggest_category"
  | "fix_grammar"
  | "shorten"
  | "translate"
  | "clean_transcript"
  | "transcript_to_items";

/** What a completion cost, from llama.rn's timings (the eval screen shows them). */
export interface AITimings {
  promptN: number;
  promptMs: number;
  predictedN: number;
  predictedMs: number;
}

export interface EditorActionResult {
  success: boolean;
  text?: string;
  items?: string[];
  error?: string;
  /** A rewrite the guard threw away (the eval reports it; the app never shows it). */
  discarded?: string;
  timings?: AITimings;
}

/** Overrides for one action: the language it answers in, the categories it picks from, the model (the eval passes its own). */
export interface EditorActionOptions {
  lang?: string;
  categories?: string[];
  modelId?: AIModelId;
}

/** A single help topic exposed to the AI intent search: its i18n base key and
 * its (already-localized) title. */
export interface HelpCatalogEntry {
  base: string;
  title: string;
}
