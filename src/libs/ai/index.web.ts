/**
 * Web-safe re-exports for @/libs/ai.
 *
 * context.ts imports `llama.rn` (native-only), so we provide no-op stubs
 * for every function it exports. helpers, constants and types are
 * platform-agnostic and re-exported as-is.
 */

import type { EvalReport, EvalResult } from "./eval";
import type { LongNoteAction, LongNoteResult } from "./longNote";
import type {
  AIModelId,
  AIModelStatus,
  EditorAction,
  EditorActionOptions,
  EditorActionResult,
  HelpCatalogEntry,
} from "./types";

export { completedJsonStrings, createTextStream, createThrottle, findCategoryByName, stripHtml } from "./helpers";
export { hasSummary, withSummary } from "./blocks";
export {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  MODEL_SIZE_ORDER,
  MODEL_SHORT_LABEL,
  isLegacyModelId,
  isModelSufficient,
  normalizeModelId,
  TRANSLATE_LANGUAGES,
} from "./constants";
export type {
  AIModelStatus,
  AIModelId,
  AIModelInfo,
  EditorAction,
  EditorActionResult,
  HelpCatalogEntry,
  LongNoteProgress,
} from "./types";
export type { EvalReport, EvalResult } from "./eval";
export type { LongNoteAction, LongNoteResult } from "./longNote";

export const LONG_NOTE_ACTIONS: ReadonlySet<EditorAction> = new Set<EditorAction>([
  "summarize",
  "fix_grammar",
  "shorten",
  "translate",
]);

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

export async function getModelPath(_modelId?: AIModelId): Promise<string> {
  return "";
}

export async function isModelDownloaded(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function downloadModel(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function cancelDownload(): Promise<void> {}

export function getModelDownload(): null {
  return null;
}

export function getDownloadFailure(): null {
  return null;
}

export async function getOrphanedModelFiles(): Promise<{ dir: string; fileName: string; size: number }[]> {
  return [];
}

export async function deleteOrphanedModelFiles(): Promise<number> {
  return 0;
}

export function getContextInfo(): null {
  return null;
}

export async function deleteModel(_modelId?: AIModelId): Promise<void> {}

export async function initContext(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export function prewarmContext(_modelId?: AIModelId): void {}

export async function cancelCommand(): Promise<void> {}

export async function releaseContext(): Promise<void> {}

export async function generateEditorContent(
  _action: string,
  _content: string,
  _onToken?: (token: string) => void,
  _options?: EditorActionOptions
): Promise<EditorActionResult> {
  return { success: false, error: "AI not available on web" };
}

export async function runAIEval(
  _modelId: AIModelId,
  _onResult: (result: EvalResult, done: number, total: number) => void,
  _shouldStop: () => boolean
): Promise<EvalReport | null> {
  return null;
}

export async function searchHelpByIntent(_query: string, _catalog: HelpCatalogEntry[]): Promise<string[]> {
  return [];
}

export async function rewriteNote(_action: Exclude<LongNoteAction, "summarize">, _html: string): Promise<LongNoteResult> {
  return { success: false, error: "AI not available on web" };
}

export async function summarizeNote(_html: string, _title: string): Promise<LongNoteResult> {
  return { success: false, error: "AI not available on web" };
}

export function estimateSeconds(_action: LongNoteAction, _html: string): number {
  return 0;
}

export function tooLongForAI(_html: string): LongNoteAction[] {
  return [];
}

export function clearLongNoteCache() {}

export function resolveLanguage(): string {
  return "en";
}
