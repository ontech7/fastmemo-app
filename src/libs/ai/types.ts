export type AIModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export type AIModelId = "qwen3.5-0.8b" | "qwen3.5-2b" | "qwen3.5-4b";

export interface AIModelInfo {
  id: AIModelId;
  name: string;
  fileName: string;
  url: string;
  /** The file's exact size: a download of any other size is incomplete or wrong, and is deleted. */
  sizeBytes: number;
  /** The file's SHA-256 (lowercase hex): a download that doesn't match is a different file. */
  sha256: string;
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
  | "summarize_part"
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
  /** A category suggestion's runner-up, when the model nearly picked it: the user chooses between the two. */
  alternative?: string;
  timings?: AITimings;
}

/** Overrides for one action: the language it answers in, the categories it picks from, the model (the eval passes its own). */
export interface EditorActionOptions {
  lang?: string;
  categories?: string[];
  modelId?: AIModelId;
  /**
   * The cancel generation a run of several actions started with (`currentGeneration()`): a cancel during one step stops
   * the steps after it too. Each action takes the current one otherwise.
   */
  generation?: number;
  /** The sampler's seed. Only the evaluation sets it, so that two runs of a model compare; the app's actions leave it out. */
  seed?: number;
}

/** A long note's action under way: the step it's on (paragraphs, or parts of a summary). */
export interface LongNoteProgress {
  done: number;
  total: number;
}

/** A single help topic exposed to the AI intent search: its i18n base key and
 * its (already-localized) title. */
export interface HelpCatalogEntry {
  base: string;
  title: string;
}

/** The model download under way, for the screen to show. */
export interface ModelDownloadProgress {
  modelId: AIModelId;
  /** 0..1, over every file of the model. */
  progress: number;
  /** Paused by the system, waiting for the network (it resumes by itself). */
  waiting: boolean;
}

/** Why the last download failed, for the screen to say: "no_space", or anything else. */
export type DownloadFailure = "no_space" | "failed";

/** What an engine loads a model with. */
export interface EngineLoadParams {
  model: string;
  n_ctx: number;
  n_gpu_layers: number;
  use_mlock: boolean;
}

/** What a completion is asked: exactly the keys the AI context passes. */
export interface EngineCompletionParams {
  messages: { role: "system" | "user"; content: string }[];
  jinja: boolean;
  enable_thinking: boolean;
  reasoning_format: "auto" | "none" | "deepseek";
  n_predict: number;
  stop: string[];
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  penalty_repeat: number;
  penalty_present: number;
  grammar?: string;
  n_probs?: number;
  seed?: number;
}

/** One token of the model's answer, with the candidates the sampler kept for it (the completion's `n_probs`). */
export interface TokenCandidates {
  content: string;
  probs: { tok_str: string; prob: number }[];
}

/** What a completion returns. */
export interface EngineCompletionResult {
  text: string;
  timings: { prompt_n: number; prompt_ms: number; predicted_n: number; predicted_ms: number };
  interrupted: boolean;
  /** llama.rn reports it as a number (0 or the limit), another engine as a flag: only its truth counts. */
  stopped_limit: boolean | number;
  truncated: boolean;
  context_full: boolean;
  completion_probabilities?: TokenCandidates[];
}

/** A model loaded in an engine. */
export interface EngineContext {
  gpu: boolean;
  reasonNoGPU: string;
  devices?: unknown;
  androidLib?: unknown;
  tokenize(text: string): Promise<{ tokens: number[] }>;
  completion(params: EngineCompletionParams, onToken?: (data: { token: string }) => void): Promise<EngineCompletionResult>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
}

/** Whether this device can run the engine. */
export interface EngineSupport {
  available: boolean;
  totalMemory: number | null;
  reason?: "cpu" | "missing" | "abi" | "error";
}
