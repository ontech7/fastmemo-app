import * as Device from "expo-device";

import { AI_MODELS } from "./constants";
import { generateEditorContent, getContextInfo, initContext, releaseContext } from "./context";
import { getEngineSupport } from "./engine";
import { EVAL_FIXTURES, LONG_NOTE_FIXTURES } from "./evalFixtures";
import { saveEvalReport } from "./evalReport";
import { clearLongNoteCache, estimateSeconds, rewriteNote, summarizeNote } from "./longNote";
import type { AIModelId, AITimings, EditorAction } from "./types";

/** The sampler's seed of every action the evaluation runs: the same model gives the same answers run after run. */
export const EVAL_SEED = 42;

export interface EvalResult {
  id: string;
  action: EditorAction;
  lang: string;
  /** Wall time of the action, from the call to its answer. */
  ms: number;
  success: boolean;
  output: string;
  error?: string;
  timings?: AITimings;
  expect: string;
  /** A long note: the calls it took (paragraphs, or parts and the merge), what was estimated, and the note it gave. */
  steps?: number;
  estimateMs?: number;
  html?: string;
}

export interface EvalReport {
  modelId: AIModelId;
  modelName: string;
  device: { model: string | null; os: string | null; totalMemory: number | null };
  /** Loading the model from a cold start. */
  loadMs: number;
  /** What it ran on (GPU or not, and why not). */
  runtime: ReturnType<typeof getContextInfo>;
  startedAt: string;
  results: EvalResult[];
  /** Where the report was saved (the `ai-eval/` folder of the documents, or of the app's data on the desktop). */
  file?: string;
}

/**
 * Runs every fixture on `modelId`, one after the other, from a cold start (the load is timed too). `onResult` gets each
 * result as it lands; `shouldStop` ends the run between two fixtures. The report is saved as JSON (`saveEvalReport`).
 * Null if the model doesn't load.
 */
export async function runAIEval(
  modelId: AIModelId,
  onResult: (result: EvalResult, done: number, total: number) => void,
  shouldStop: () => boolean
): Promise<EvalReport | null> {
  await releaseContext();
  const startedAt = new Date().toISOString();
  const loadStart = Date.now();
  if (!(await initContext(modelId))) return null;
  const loadMs = Date.now() - loadStart;

  const total = EVAL_FIXTURES.length + LONG_NOTE_FIXTURES.length;
  const results: EvalResult[] = [];
  for (const fixture of EVAL_FIXTURES) {
    if (shouldStop()) break;
    const start = Date.now();
    const answer = await generateEditorContent(fixture.action, fixture.input, undefined, {
      lang: fixture.lang,
      categories: fixture.categories,
      modelId,
      seed: EVAL_SEED,
    });
    const result: EvalResult = {
      id: fixture.id,
      action: fixture.action,
      lang: fixture.lang,
      ms: Date.now() - start,
      success: answer.success,
      output: answer.items ? JSON.stringify(answer.items) : (answer.text ?? answer.discarded ?? ""),
      error: answer.error,
      timings: answer.timings,
      expect: fixture.expect,
    };
    results.push(result);
    onResult(result, results.length, total);
  }

  clearLongNoteCache();
  for (const fixture of LONG_NOTE_FIXTURES) {
    if (shouldStop()) break;
    const estimateMs = Math.round(estimateSeconds(fixture.action, fixture.html, modelId) * 1000);
    let steps = 0;
    const handlers = { onProgress: ({ total: count }: { total: number }) => (steps = count) };
    const options = { lang: fixture.lang, modelId, seed: EVAL_SEED };
    const start = Date.now();
    const answer =
      fixture.action === "summarize"
        ? await summarizeNote(fixture.html, fixture.title ?? "", handlers, options)
        : await rewriteNote(fixture.action, fixture.html, handlers, options);
    const result: EvalResult = {
      id: fixture.id,
      action: fixture.action,
      lang: fixture.lang,
      ms: Date.now() - start,
      success: answer.success,
      output: answer.text ?? "",
      error: answer.error,
      expect: fixture.expect,
      steps,
      estimateMs,
      html: answer.html,
    };
    results.push(result);
    onResult(result, results.length, total);
  }

  const report: EvalReport = {
    modelId,
    modelName: AI_MODELS[modelId].name,
    device: { model: Device.modelName, os: Device.osVersion, totalMemory: (await getEngineSupport()).totalMemory },
    loadMs,
    runtime: getContextInfo(),
    startedAt,
    results,
  };
  const file = await saveEvalReport(report);
  if (file) report.file = file;
  return report;
}
