import { isTauri } from "@/utils/platform";
import { AI_MODELS, getModel, normalizeModelId } from "./constants";
import { catalogSizes, downloaded, getAllModelFiles } from "./modelFiles";
import { notifyListeners, releaseLoadedModel } from "./status";
import type { AIModelId, DownloadFailure, ModelDownloadProgress } from "./types";

// The desktop's model files: the models folder of the Tauri shell (`src-tauri/src/ai/`), reached through its commands. The
// page only ever names a file by its bare name; Rust knows the folder. A plain browser has none.

const tauriCore = () => import("@tauri-apps/api/core");

/** A file of the models folder, as `ai_model_files` lists it (a download under way or cut is `<name>.part`). */
interface ListedFile {
  fileName: string;
  size: number;
}

const PART_SUFFIX = ".part";

let _download: Promise<boolean> | null = null;
let _downloadProgress: ModelDownloadProgress | null = null;
let _downloadFailure: DownloadFailure | null = null;
/** Bumped by a cancel: the download that started before it stops. */
let _downloadGeneration = 0;

/** The folder's files. Throws when the shell can't list them: a caller that deletes on this must not read it as "empty". */
async function listFiles(): Promise<ListedFile[]> {
  if (!isTauri()) return [];
  const { invoke } = await tauriCore();
  return invoke<ListedFile[]>("ai_model_files");
}

/** Frees the loaded model (a file in use can't be deleted on Windows), then deletes the files. */
async function deleteFiles(fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) return;
  await releaseLoadedModel();
  const { invoke } = await tauriCore();
  await invoke("ai_delete_files", { fileNames });
}

/** The bare file name: the shell looks for it in its own folder. */
export async function getModelPath(modelId?: AIModelId): Promise<string> {
  return getModel(modelId).fileName;
}

/** A model counts as downloaded only when every file is there at its exact size (a cut-off download is not). */
export async function isModelDownloaded(modelId?: AIModelId): Promise<boolean> {
  try {
    const listed = new Map((await listFiles()).map((f) => [f.fileName, f.size]));
    return getAllModelFiles(modelId).every((file) => listed.get(file.fileName) === file.sizeBytes);
  } catch (error) {
    console.error("[AI] List model files failed:", error);
    return false;
  }
}

/**
 * The listed files no model of today's catalog uses at that size: old models, and downloads cut off. A catalog file's own
 * `.part` is not one: that model's download resumes it, and another model's download removes it (one model at a time).
 */
function leftovers(listed: ListedFile[]): ListedFile[] {
  const sizes = catalogSizes();
  return listed.filter(
    (file) =>
      sizes.get(file.fileName) !== file.size &&
      !(file.fileName.endsWith(PART_SUFFIX) && sizes.has(file.fileName.slice(0, -PART_SUFFIX.length)))
  );
}

/** Files in the models folder that no model of today's catalog uses, and catalog files short of their size. */
export async function getOrphanedModelFiles(): Promise<{ dir: string; fileName: string; size: number }[]> {
  try {
    return leftovers(await listFiles()).map(({ fileName, size }) => ({ dir: "models", fileName, size }));
  } catch (error) {
    console.error("[AI] List model files failed:", error);
    return [];
  }
}

/** Deletes the leftover model files; returns the bytes freed. */
export async function deleteOrphanedModelFiles(): Promise<number> {
  const orphans = await getOrphanedModelFiles();
  if (orphans.length === 0) return 0;
  try {
    await deleteFiles(orphans.map((o) => o.fileName));
    return orphans.reduce((sum, o) => sum + o.size, 0);
  } catch (error) {
    // busy: a download still runs in Rust (one this page started before a reload), and its file is not ours to delete
    if (error !== "busy") console.error("[AI] Delete old model file failed:", error);
    return 0;
  }
}

/** Deletes every file of `modelId`, the `.part` of a cut download included. */
export async function deleteModelFiles(modelId: AIModelId): Promise<void> {
  const mine = new Set(getAllModelFiles(modelId).flatMap((f) => [f.fileName, f.fileName + PART_SUFFIX]));
  await deleteFiles((await listFiles()).filter((f) => mine.has(f.fileName)).map((f) => f.fileName));
}

/*
 * The download. Rust writes `<name>.part`, resumes it with a Range request, checks the size and the SHA-256 and renames it;
 * it runs only while the app does. One download at a time (a second answers "busy").
 */

/** The download under way, or null: a screen opened meanwhile shows it. */
export function getModelDownload(): ModelDownloadProgress | null {
  return _downloadProgress;
}

/** Why the last download failed (null when it didn't). */
export function getDownloadFailure(): DownloadFailure | null {
  return _downloadFailure;
}

/** What `ai_download` rejects with, as the failure the screen says. */
const failureOf = (error: unknown): DownloadFailure => (error === "no_space" ? "no_space" : "failed");

async function runDownload(modelId: AIModelId, generation: number): Promise<boolean> {
  const files = getAllModelFiles(modelId);
  try {
    _downloadFailure = null;
    // A file nobody pinned a checksum for is not downloaded: what arrives could be anything.
    if (files.some((file) => !file.sha256)) {
      console.error("[AI] No checksum pinned for", modelId);
      _downloadFailure = "failed";
      notifyListeners("error");
      return false;
    }
    _downloadProgress = { modelId, progress: 0, waiting: false };
    notifyListeners("downloading", 0);

    // One model on the device at a time: the others go, and so does anything left over (old models, partial files). The
    // `.part` of this model's own files stays: the download resumes it.
    const sizes = catalogSizes();
    const keep = new Set(files.map((file) => file.fileName + PART_SUFFIX));
    const others = new Set(
      (Object.keys(AI_MODELS) as AIModelId[])
        .filter((id) => id !== modelId)
        .flatMap((id) => getAllModelFiles(id).flatMap((f) => [f.fileName, f.fileName + PART_SUFFIX]))
    );
    const doomed = (await listFiles())
      .filter((f) => !keep.has(f.fileName) && (others.has(f.fileName) || sizes.get(f.fileName) !== f.size))
      .map((f) => f.fileName);
    await deleteFiles(doomed);
    if (generation !== _downloadGeneration) return false;

    const { invoke, Channel } = await tauriCore();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const whole = new Map((await listFiles()).map((f) => [f.fileName, f.size])).get(file.fileName) === file.sizeBytes;
      if (whole) continue;
      // Rust honours a cancel only for a download that has begun: one asked for during the awaits above ends here
      if (generation !== _downloadGeneration) return false;
      const progress = new Channel<{ received: number; total: number }>();
      // a message can arrive after the download ended: it must not bring the progress back
      let running = true;
      progress.onmessage = ({ received, total }) => {
        if (!running || generation !== _downloadGeneration) return;
        const fraction = total > 0 ? Math.min(received / total, 1) : 0;
        _downloadProgress = { modelId, progress: (i + fraction) / files.length, waiting: false };
        notifyListeners("downloading", _downloadProgress.progress);
      };
      try {
        await invoke("ai_download", {
          file: { fileName: file.fileName, url: file.url, size: file.sizeBytes, sha256: file.sha256 },
          onProgress: progress,
        });
      } catch (error) {
        // cancelled meanwhile: the cancel said so
        if (generation !== _downloadGeneration) return false;
        _downloadProgress = null;
        if (error === "cancelled") {
          notifyListeners("idle");
        } else {
          console.error("[AI] Download failed:", file.fileName, error);
          _downloadFailure = failureOf(error);
          notifyListeners("error");
        }
        return false;
      } finally {
        running = false;
      }
      if (generation !== _downloadGeneration) return false;
    }

    downloaded(modelId);
    _downloadProgress = null;
    notifyListeners("idle");
    return true;
  } catch (error) {
    if (generation !== _downloadGeneration) return false;
    console.error("[AI] Download failed:", error);
    _downloadFailure = "failed";
    _downloadProgress = null;
    notifyListeners("error");
    return false;
  }
}

/** The download being started: it first ends the one under way. A second call for the same model joins it. */
interface Start {
  modelId: AIModelId;
  promise: Promise<boolean>;
}
let _start: Start | null = null;

/** Downloads `modelId` (its files not on the device yet), or follows its download under way. */
export function downloadModel(modelId?: AIModelId): Promise<boolean> {
  if (!isTauri()) return Promise.resolve(false);
  const targetId = normalizeModelId(modelId);
  if (_download && _downloadProgress?.modelId === targetId) return _download;
  if (_start?.modelId === targetId) return _start.promise;

  // Ending the download under way takes a while: a call meanwhile must not start a second one (Rust answers "busy").
  const previous = _start?.promise;
  const mine: Start = { modelId: targetId, promise: Promise.resolve(false) };
  _start = mine;
  mine.promise = (async () => {
    if (previous) await previous;
    if (_download) await stopDownload();
    // a call for another model, or a cancel, came meanwhile
    if (_start !== mine) return false;
    _start = null;
    const download = runDownload(targetId, _downloadGeneration).finally(() => {
      if (_download === download) _download = null;
    });
    _download = download;
    return download;
  })();
  return mine.promise;
}

async function stopDownload(): Promise<void> {
  _downloadGeneration++;
  const download = _download;
  _download = null;
  _downloadProgress = null;
  try {
    if (isTauri()) {
      const { invoke } = await tauriCore();
      await invoke("ai_download_cancel");
    }
    await download?.catch(() => undefined);
  } catch (error) {
    console.error("[AI] Cancel download failed:", error);
  }
  notifyListeners("idle");
}

export async function cancelDownload(): Promise<void> {
  // a download still being started is cancelled too
  _start = null;
  await stopDownload();
}
