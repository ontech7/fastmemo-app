import * as FileSystem from "expo-file-system/legacy";
import { t } from "i18next";
import { AppState } from "react-native";

import { selectorAIAssistant, setAIAssistant } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import type { RootState } from "@/types";
import FastmemoDownloads from "~/modules/fastmemo-downloads";
import { AI_MODELS, MODEL_DOWNLOAD_RECORD, getModel, normalizeModelId } from "./constants";
import { notifyListeners, releaseLoadedModel } from "./status";
import type { AIModelId, DownloadFailure, ModelDownloadProgress } from "./types";

/** Where models were downloaded before the system download (ADR-028), and still are without it: the app's private files. */
const APP_MODELS_DIR = () => `${FileSystem.documentDirectory}models/`;

let _downloadDir: string | null = null;
/**
 * Where a new download goes: the folder the system's download manager writes (the app's own, on the shared storage), or the
 * app's private files on a binary without it.
 */
const DOWNLOAD_DIR = (): string => (_downloadDir ??= FastmemoDownloads?.modelsDir() ?? APP_MODELS_DIR());

/** Every folder a model file can be in, the download one first. */
const modelDirs = (): string[] => [...new Set([DOWNLOAD_DIR(), APP_MODELS_DIR()])];

/** Deletes a model file: in the download manager's folder through the module (expo-file-system can't delete there). */
async function deleteModelFile(dir: string, fileName: string): Promise<void> {
  if (FastmemoDownloads && dir !== APP_MODELS_DIR()) await FastmemoDownloads.deleteAsync(fileName);
  else await FileSystem.deleteAsync(`${dir}${fileName}`, { idempotent: true });
}

type ModelFile = { fileName: string; url: string; sizeBytes: number };

function getAllModelFiles(modelId?: AIModelId): ModelFile[] {
  const model = getModel(modelId);
  return [{ fileName: model.fileName, url: model.url, sizeBytes: model.sizeBytes }, ...(model.parts ?? [])];
}

/** Every file the catalog downloads, with its size: anything else in a models folder is a leftover. */
function catalogSizes(): Map<string, number> {
  return new Map(
    (Object.keys(AI_MODELS) as AIModelId[]).flatMap((id) => getAllModelFiles(id).map((f) => [f.fileName, f.sizeBytes]))
  );
}

/** Where `file` is, whole: a file of another size is cut off or not the one pinned, and never loaded. */
async function findModelFile(file: ModelFile): Promise<string | null> {
  for (const dir of modelDirs()) {
    const info = await FileSystem.getInfoAsync(`${dir}${file.fileName}`);
    if (info.exists && info.size === file.sizeBytes) return `${dir}${file.fileName}`;
  }
  return null;
}

export async function getModelPath(modelId?: AIModelId): Promise<string> {
  const [main] = getAllModelFiles(modelId);
  return (await findModelFile(main)) ?? `${DOWNLOAD_DIR()}${main.fileName}`;
}

/** A model counts as downloaded only when every file is there at its exact size (a cut-off download is not). */
export async function isModelDownloaded(modelId?: AIModelId): Promise<boolean> {
  for (const file of getAllModelFiles(modelId)) {
    if (!(await findModelFile(file))) return false;
  }
  return true;
}

/**
 * Files in the models folders that no model of today's catalog uses (the Qwen 2.5 models of earlier versions), and catalog
 * files short of their size: a download that died, unless the in-app one is writing them now (a system download writes
 * elsewhere until it's done).
 */
export async function getOrphanedModelFiles(): Promise<{ dir: string; fileName: string; size: number }[]> {
  const sizes = catalogSizes();
  const orphans: { dir: string; fileName: string; size: number }[] = [];
  for (const dir of modelDirs()) {
    if (!(await FileSystem.getInfoAsync(dir)).exists) continue;
    for (const fileName of await FileSystem.readDirectoryAsync(dir)) {
      const info = await FileSystem.getInfoAsync(`${dir}${fileName}`);
      const size = info.exists ? (info.size ?? 0) : 0;
      if (sizes.get(fileName) === size || (sizes.has(fileName) && _activeDownload && dir === APP_MODELS_DIR())) continue;
      orphans.push({ dir, fileName, size });
    }
  }
  return orphans;
}

/** Deletes the leftover model files; returns the bytes freed. */
export async function deleteOrphanedModelFiles(): Promise<number> {
  const orphans = await getOrphanedModelFiles();
  if (orphans.length === 0) return 0;
  await releaseLoadedModel();
  let freed = 0;
  for (const orphan of orphans) {
    try {
      await deleteModelFile(orphan.dir, orphan.fileName);
      freed += orphan.size;
    } catch (error) {
      console.error("[AI] Delete old model file failed:", error);
    }
  }
  return freed;
}

/** Deletes every file of `modelId`, in every models folder. */
export async function deleteModelFiles(modelId: AIModelId): Promise<void> {
  for (const file of getAllModelFiles(modelId)) {
    for (const dir of modelDirs()) {
      if ((await FileSystem.getInfoAsync(`${dir}${file.fileName}`)).exists) {
        await releaseLoadedModel();
        await deleteModelFile(dir, file.fileName);
      }
    }
  }
}

/*
 * The download (ADR-028). Through the system's download manager it goes on with the screen off and the app in the background
 * or closed, with its progress in a notification: the system download under way is written down, and the app picks it up at
 * its next start (or when it comes back to the foreground). Without the module (an old binary), the app downloads it itself,
 * only while it runs.
 */

/** The system download under way, kept across restarts. */
interface DownloadRecord {
  modelId: AIModelId;
  fileName: string;
  id: number;
}

const DOWNLOAD_RECORD = () => `${FileSystem.documentDirectory}${MODEL_DOWNLOAD_RECORD}`;

async function readDownloadRecord(): Promise<DownloadRecord | null> {
  try {
    if (!(await FileSystem.getInfoAsync(DOWNLOAD_RECORD())).exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(DOWNLOAD_RECORD()));
  } catch {
    return null;
  }
}

async function writeDownloadRecord(record: DownloadRecord | null): Promise<void> {
  if (record) await FileSystem.writeAsStringAsync(DOWNLOAD_RECORD(), JSON.stringify(record));
  else await FileSystem.deleteAsync(DOWNLOAD_RECORD(), { idempotent: true });
}

/** How often a system download is asked how far it got. */
const DOWNLOAD_POLL_MS = 500;
/** DownloadManager.ERROR_INSUFFICIENT_SPACE. */
const ERROR_INSUFFICIENT_SPACE = 1006;

let _download: Promise<boolean> | null = null;
let _downloadProgress: ModelDownloadProgress | null = null;
let _downloadFailure: DownloadFailure | null = null;
/** Bumped by a cancel: the download that started before it stops. */
let _downloadGeneration = 0;
/** The in-app download (without the module). */
let _activeDownload: FileSystem.DownloadResumable | null = null;

/** The download under way, or null: a screen opened meanwhile shows it. */
export function getModelDownload(): ModelDownloadProgress | null {
  return _downloadProgress;
}

/** Why the last download failed (null when it didn't). */
export function getDownloadFailure(): DownloadFailure | null {
  return _downloadFailure;
}

type FileResult = "done" | "cancelled" | DownloadFailure;

async function downloadWithSystem(
  modelId: AIModelId,
  file: ModelFile,
  resumeId: number | null,
  generation: number,
  report: (fraction: number, waiting: boolean) => void
): Promise<FileResult> {
  const downloads = FastmemoDownloads!;
  let id = resumeId;
  if (id === null) {
    id = await downloads.startAsync(file.url, file.fileName, getModel(modelId).name, t("ai.download_notification"));
    // cancelled while it was being started: the cancel didn't know it yet
    if (generation !== _downloadGeneration) {
      await downloads.cancelAsync(id, file.fileName);
      return "cancelled";
    }
    await writeDownloadRecord({ modelId, fileName: file.fileName, id });
  }
  for (;;) {
    if (generation !== _downloadGeneration) return "cancelled";
    const state = await downloads.queryAsync(id);
    if (generation !== _downloadGeneration) return "cancelled";
    switch (state.status) {
      case "successful":
        return (await downloads.finishAsync(id, file.fileName)) && (await findModelFile(file)) ? "done" : "failed";
      case "failed":
        console.error("[AI] Download failed:", file.fileName, state.reason);
        await downloads.cancelAsync(id, file.fileName);
        return state.reason === ERROR_INSUFFICIENT_SPACE ? "no_space" : "failed";
      // removed from its notification: as a cancel
      case "missing":
        return "cancelled";
    }
    report(state.total > 0 ? state.downloaded / state.total : 0, state.status === "paused");
    await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_POLL_MS));
  }
}

async function downloadInApp(file: ModelFile, report: (fraction: number, waiting: boolean) => void): Promise<FileResult> {
  const filePath = `${APP_MODELS_DIR()}${file.fileName}`;
  _activeDownload = FileSystem.createDownloadResumable(file.url, filePath, {}, (dp) => {
    report(dp.totalBytesExpectedToWrite > 0 ? dp.totalBytesWritten / dp.totalBytesExpectedToWrite : 0, false);
  });
  try {
    await _activeDownload.downloadAsync();
  } catch (error) {
    // a cancel throws too
    if (String(error).includes("cancel")) return "cancelled";
    throw error;
  } finally {
    _activeDownload = null;
  }
  if (await findModelFile(file)) return "done";
  console.error("[AI] Download incomplete:", file.fileName);
  await FileSystem.deleteAsync(filePath, { idempotent: true });
  return "failed";
}

/** A finished download asks for the AI: switching models turned it off, the download turns it back on. */
function downloaded(modelId: AIModelId) {
  const ai = selectorAIAssistant(store.getState() as RootState);
  if (normalizeModelId(ai.selectedModel) === modelId) {
    store.dispatch(setAIAssistant({ ...ai, modelDownloaded: true, enabled: true }));
  }
}

async function runDownload(modelId: AIModelId, resume: DownloadRecord | null, generation: number): Promise<boolean> {
  const files = getAllModelFiles(modelId);
  try {
    _downloadFailure = null;
    _downloadProgress = { modelId, progress: 0, waiting: false };
    notifyListeners("downloading", 0);

    if (!resume) {
      // One model on the device at a time: the others go, and so does anything left over (old models, partial files).
      await deleteOrphanedModelFiles();
      for (const otherId of Object.keys(AI_MODELS) as AIModelId[]) {
        if (otherId !== modelId) await deleteModelFiles(otherId);
      }
    }
    if (!(await FileSystem.getInfoAsync(DOWNLOAD_DIR())).exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR(), { intermediates: true });
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (await findModelFile(file)) continue;
      const report = (fraction: number, waiting: boolean) => {
        if (generation !== _downloadGeneration) return;
        _downloadProgress = { modelId, progress: (i + fraction) / files.length, waiting };
        notifyListeners("downloading", _downloadProgress.progress);
      };
      const result = FastmemoDownloads
        ? await downloadWithSystem(modelId, file, resume?.fileName === file.fileName ? resume.id : null, generation, report)
        : await downloadInApp(file, report);
      // cancelled meanwhile: the cancel cleaned up and said so
      if (generation !== _downloadGeneration) return false;
      if (result !== "done") {
        await writeDownloadRecord(null);
        if (result === "cancelled") {
          _downloadProgress = null;
          notifyListeners("idle");
          return false;
        }
        _downloadFailure = result;
        _downloadProgress = null;
        notifyListeners("error");
        return false;
      }
    }

    await writeDownloadRecord(null);
    downloaded(modelId);
    _downloadProgress = null;
    notifyListeners("idle");
    return true;
  } catch (error) {
    if (generation !== _downloadGeneration) return false;
    console.error("[AI] Download failed:", error);
    await writeDownloadRecord(null).catch(() => undefined);
    _downloadFailure = "failed";
    _downloadProgress = null;
    notifyListeners("error");
    return false;
  }
}

function startDownload(modelId: AIModelId, resume: DownloadRecord | null): Promise<boolean> {
  const download = runDownload(modelId, resume, _downloadGeneration).finally(() => {
    if (_download === download) _download = null;
  });
  _download = download;
  return download;
}

/** Downloads `modelId` (its files not on the device yet), or follows its download under way. */
export async function downloadModel(modelId?: AIModelId): Promise<boolean> {
  const targetId = normalizeModelId(modelId);
  if (_download && _downloadProgress?.modelId === targetId) return _download;
  if (_download) await cancelDownload();
  return startDownload(targetId, null);
}

/**
 * Picks up the system download the app was closed during: follows it, or finishes one done meanwhile. At the app's start,
 * without one, clears what a download may have left in the staging folder.
 */
async function resumeModelDownload(atStart: boolean): Promise<void> {
  if (_download || !FastmemoDownloads) return;
  const record = await readDownloadRecord();
  if (_download) return;
  if (record) void startDownload(normalizeModelId(record.modelId), record);
  else if (atStart) await FastmemoDownloads.clearStagingAsync();
}

export async function cancelDownload(): Promise<void> {
  _downloadGeneration++;
  const download = _download;
  _download = null;
  _downloadProgress = null;
  try {
    const record = await readDownloadRecord();
    if (record && FastmemoDownloads) await FastmemoDownloads.cancelAsync(record.id, record.fileName);
    await writeDownloadRecord(null);
    if (_activeDownload) await _activeDownload.cancelAsync().catch(() => undefined);
    await download?.catch(() => undefined);
    // what the download left: catalog files short of their size, and anything outside the catalog
    await deleteOrphanedModelFiles();
  } catch (error) {
    console.error("[AI] Cancel download failed:", error);
  }
  notifyListeners("idle");
}

// a download the app was closed during goes on: picked up now, and each time the app comes back
void resumeModelDownload(true);
AppState.addEventListener("change", (state) => {
  if (state === "active") void resumeModelDownload(false);
});
