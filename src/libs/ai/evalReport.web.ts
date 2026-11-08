import { exportAsTextFile } from "@/utils/export";
import { isTauri } from "@/utils/platform";

import type { EvalReport } from "./eval";

// The desktop's evaluation report: saved by the shell in its own folder (`ai_save_eval_report`, app local data folder,
// `ai-eval/`), and shared through the save dialog. The phone's is in evalReport.ts.

/** What this page session saved, by the path the shell answered: the report is shared from the screen that just ran it. */
const saved = new Map<string, string>();

const tauriCore = () => import("@tauri-apps/api/core");

/** The file name of a path, either kind of separator. */
const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

/**
 * Saves the report as JSON in the shell's `ai-eval/` folder and answers the file's full path. Null if there is no shell
 * (a plain browser) or it couldn't be written.
 */
export async function saveEvalReport(report: EvalReport): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await tauriCore();
    const json = JSON.stringify(report, null, 2);
    const fileName = `${report.modelId}-${report.startedAt.replace(/[:.]/g, "-")}.json`;
    const file = await invoke<string>("ai_save_eval_report", { fileName, json });
    saved.set(file, json);
    return file;
  } catch (e) {
    console.log("[AI] eval report not saved:", e);
    return null;
  }
}

/** Opens the save dialog for a report saved in this page session (the path `saveEvalReport` answered), and writes it there. */
export async function shareEvalReport(file: string): Promise<void> {
  const json = saved.get(file);
  if (json === undefined) {
    console.log("[AI] eval report to share not known:", file);
    return;
  }
  try {
    await exportAsTextFile(json, baseName(file));
  } catch (e) {
    console.log("[AI] eval report not shared:", e);
  }
}
