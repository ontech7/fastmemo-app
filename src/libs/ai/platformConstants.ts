import type { AIModelId } from "./types";

// What differs per platform. This is the phone's (llama.rn); the desktop's are in platformConstants.web.ts.

/** The context the model is loaded with, in tokens. */
export const CONTEXT_SIZE: Record<AIModelId, number> = {
  "qwen3.5-0.8b": 4096,
  "qwen3.5-2b": 8192,
  "qwen3.5-4b": 8192,
};

/** Pin the weights in RAM (faster, but a large model can be killed for it on a phone with little to spare). */
export const USE_MLOCK: Record<AIModelId, boolean> = {
  "qwen3.5-0.8b": true,
  "qwen3.5-2b": true,
  "qwen3.5-4b": false,
};

/** The model an AI never set up starts with. */
export const DEFAULT_MODEL_ID: AIModelId = "qwen3.5-0.8b";

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
 * A summary reads the note in parts of about this many tokens (one call each, then one that merges them). A summary of the
 * whole note at once is better than one merged from parts (AI evaluation, 2026-10), but a part is read before anything
 * shows: about 15 s on the 2B and 55 s on the 4B on the reference phone.
 */
export const SUMMARY_PART_TOKENS = 1500;

/** A rewrite takes a paragraph longer than this many tokens a few sentences at a time (room to write in, and progress). */
export const REWRITE_PIECE_TOKENS = 600;

/** Whether this platform can run the AI at all (the phone's engine is native, always there). */
export function supportsAI(): boolean {
  return true;
}
