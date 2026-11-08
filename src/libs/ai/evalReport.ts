import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import type { EvalReport } from "./eval";

// The phone's evaluation report: a JSON file in documents/ai-eval/, handed to the share sheet. The desktop's is in
// evalReport.web.ts.

/**
 * Saves the report as JSON under documents/ai-eval/ and answers the file's path. Null if it couldn't be written.
 */
export async function saveEvalReport(report: EvalReport): Promise<string | null> {
  try {
    const dir = `${FileSystem.documentDirectory}ai-eval/`;
    if (!(await FileSystem.getInfoAsync(dir)).exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const file = `${dir}${report.modelId}-${report.startedAt.replace(/[:.]/g, "-")}.json`;
    await FileSystem.writeAsStringAsync(file, JSON.stringify(report, null, 2));
    return file;
  } catch (e) {
    console.log("[AI] eval report not saved:", e);
    return null;
  }
}

/** Hands a saved report (the path `saveEvalReport` answered) to the share sheet. */
export async function shareEvalReport(file: string): Promise<void> {
  await Sharing.shareAsync(file, { mimeType: "application/json" });
}
