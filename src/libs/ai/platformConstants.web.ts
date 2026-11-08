import { isTauri } from "@/utils/platform";

import type { AIModelId } from "./types";

// What differs on the desktop (the web build in the Tauri shell): a computer has the RAM for a longer context and for the
// larger models, and reads faster, so a long note goes in bigger parts. The phone's are in platformConstants.ts.

/** The context the model is loaded with, in tokens. */
export const CONTEXT_SIZE: Record<AIModelId, number> = {
  "qwen3.5-0.8b": 8192,
  "qwen3.5-2b": 16384,
  "qwen3.5-4b": 16384,
};

/** Never pinned: a computer pages out what it doesn't need, and mlock can fail on a limit of the user's. */
export const USE_MLOCK: Record<AIModelId, boolean> = {
  "qwen3.5-0.8b": false,
  "qwen3.5-2b": false,
  "qwen3.5-4b": false,
};

/** The model an AI never set up starts with. */
export const DEFAULT_MODEL_ID: AIModelId = "qwen3.5-2b";

/**
 * Tokens per second on the reference computer's CPU (Apple M5, half its cores, 2026-11-08): Windows and Linux run there.
 * Metal on Apple Silicon reads 5-10 times faster, so its estimates err long.
 */
export const MODEL_SPEED: Record<AIModelId, { prefill: number; generate: number }> = {
  "qwen3.5-0.8b": { prefill: 463, generate: 113 },
  "qwen3.5-2b": { prefill: 224, generate: 59 },
  "qwen3.5-4b": { prefill: 95, generate: 27 },
};

/** A summary reads the note in parts of about this many tokens (one call each, then one that merges them). */
export const SUMMARY_PART_TOKENS = 6000;

/** A rewrite takes a paragraph longer than this many tokens a few sentences at a time. */
export const REWRITE_PIECE_TOKENS = 1200;

/** Whether this platform can run the AI at all: only the desktop shell, not a plain browser. */
export function supportsAI(): boolean {
  return isTauri();
}
