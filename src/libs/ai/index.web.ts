/**
 * Web-safe re-exports for @/libs/ai.
 *
 * context.ts imports `llama.rn` (native-only), so we provide no-op stubs
 * for every function it exports. helpers, constants and types are
 * platform-agnostic and re-exported as-is.
 */

import type { AIModelId, AIModelStatus, EditorActionResult } from "./types";

export { findCategoryByName, stripHtml } from "./helpers";
export { AI_MODELS, DEFAULT_MODEL_ID } from "./constants";
export type { AIModelStatus, AIModelId, AIModelInfo, EditorAction, EditorActionResult } from "./types";

// --- no-op stubs for context.ts functions (native-only) ---

export function isNativeModuleAvailable(): boolean {
  return false;
}

export function getAIStatus(): AIModelStatus {
  return "idle";
}

export function addAIStatusListener(_listener: (status: AIModelStatus, progress?: number) => void): () => void {
  return () => {};
}

export function getModelPath(_modelId?: AIModelId): string {
  return "";
}

export async function isModelDownloaded(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function downloadModel(_modelId?: AIModelId, _onProgress?: (progress: number) => void): Promise<boolean> {
  return false;
}

export async function cancelDownload(): Promise<void> {}

export async function deleteModel(_modelId?: AIModelId): Promise<void> {}

export async function initContext(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function cancelCommand(): Promise<void> {}

export async function releaseContext(): Promise<void> {}

export async function generateEditorContent(
  _action: string,
  _content: string,
  _onToken?: (token: string) => void
): Promise<EditorActionResult> {
  return { success: false, error: "AI not available on web" };
}
