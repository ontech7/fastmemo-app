import * as FileSystem from "expo-file-system/legacy";
import * as Localization from "expo-localization";
import { t } from "i18next";
import { initLlama, type LlamaContext } from "llama.rn";
import { AppState, NativeModules } from "react-native";

import { selectorAIAssistant, setAIAssistant } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import type { RootState } from "@/types";
import FastmemoDownloads from "~/modules/fastmemo-downloads";
import {
  ACTION_MAX_TOKENS,
  ACTION_SAMPLING,
  AI_MODELS,
  HELP_SEARCH_SAMPLING,
  HELP_SEARCH_SYSTEM_PROMPT,
  JSON_ARRAY_GRAMMAR,
  JSON_INT_ARRAY_GRAMMAR,
  MODEL_DOWNLOAD_RECORD,
  MODEL_SPEED,
  getEditorSystemPrompt,
  normalizeModelId,
  truncateForAction,
} from "./constants";
import { completeSentences } from "./blocks";
import {
  categoryAlternative,
  categoryGrammar,
  cleanAnswer,
  cleanSuggestedItems,
  isPlausibleRewrite,
  stripThinking,
} from "./helpers";
import type {
  AIModelId,
  AIModelInfo,
  AIModelStatus,
  AITimings,
  EditorAction,
  EditorActionOptions,
  EditorActionResult,
  HelpCatalogEntry,
} from "./types";

type StatusListener = (status: AIModelStatus, progress?: number) => void;

/** Resolve the effective language code, handling the "system" default. */
export function resolveLanguage(): string {
  const lang = store.getState().settings.language;
  if (!lang || lang === "system") {
    return Localization.getLocales()[0]?.languageCode || "en";
  }
  return lang;
}

let _context: LlamaContext | null = null;
let _status: AIModelStatus = "idle";
let _listeners: StatusListener[] = [];
let _initPromise: Promise<boolean> | null = null;

/**
 * Check if the llama.rn native module is available.
 * Returns false when running in Expo Go or when the native build
 * hasn't been rebuilt after adding llama.rn.
 */
export function isNativeModuleAvailable(): boolean {
  return NativeModules.RNLlama != null;
}

function notifyListeners(status: AIModelStatus, progress?: number) {
  _status = status;
  _listeners.forEach((listener) => listener(status, progress));
}

export function getAIStatus(): AIModelStatus {
  return _status;
}

export function addAIStatusListener(listener: StatusListener): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

/** The model the settings name now (an id stored by an earlier version maps to its replacement). */
export function selectedModelId(): AIModelId {
  return normalizeModelId(store.getState().settings.aiAssistant?.selectedModel);
}

function getModel(modelId?: AIModelId): AIModelInfo {
  return AI_MODELS[normalizeModelId(modelId)];
}

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
  await releaseContext();
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
async function deleteModelFiles(modelId: AIModelId): Promise<void> {
  for (const file of getAllModelFiles(modelId)) {
    for (const dir of modelDirs()) {
      if ((await FileSystem.getInfoAsync(`${dir}${file.fileName}`)).exists) {
        await releaseContext();
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

export interface ModelDownloadProgress {
  modelId: AIModelId;
  /** 0..1, over every file of the model. */
  progress: number;
  /** Paused by the system, waiting for the network (it resumes by itself). */
  waiting: boolean;
}

/** Why the last download failed, for the screen to say: "no_space", or anything else. */
export type DownloadFailure = "no_space" | "failed";

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

export async function deleteModel(modelId?: AIModelId): Promise<void> {
  try {
    await releaseContext();
    await deleteModelFiles(normalizeModelId(modelId));
    notifyListeners("idle");
  } catch (error) {
    console.error("[AI] Delete model failed:", error);
  }
}

let _activeModelId: AIModelId | null = null;
/** The model `_initPromise` is loading. */
let _loadingModelId: AIModelId | null = null;

/*
 * Loading takes seconds, so a loaded model stays: it is released 3 minutes after the last use, and when the app goes to
 * the background (its RAM is the system's to take back). Never under a running completion: `_busy` counts them.
 */
const IDLE_RELEASE_MS = 3 * 60 * 1000;
let _busy = 0;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleRelease() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = null;
}

function scheduleRelease() {
  clearIdleRelease();
  if (!_context || _busy > 0) return;
  if (AppState.currentState === "background") {
    void releaseContext();
    return;
  }
  _idleTimer = setTimeout(() => {
    _idleTimer = null;
    if (_busy === 0) void releaseContext();
  }, IDLE_RELEASE_MS);
}

AppState.addEventListener("change", (state) => {
  if (state === "background") scheduleRelease();
});

/** The previous completion's end: one context runs one completion at a time (a second one fails "Context is busy"). */
let _queue: Promise<void> = Promise.resolve();

/** Runs `work` after the completions before it, with the context marked busy, then restarts the idle countdown. */
async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
  _busy++;
  clearIdleRelease();
  const previous = _queue;
  let done!: () => void;
  _queue = new Promise<void>((resolve) => (done = resolve));
  try {
    await previous;
    return await work();
  } finally {
    done();
    _busy--;
    scheduleRelease();
  }
}

/**
 * Bumped by every cancel. A run compares it with the value it started with at each step (in the queue, after the load, at
 * every token): a stop sent while the model was still loading would otherwise be lost, and the answer run to its limit.
 */
let _cancelGeneration = 0;

/** The current cancel generation: a run of several actions passes it to each (`EditorActionOptions.generation`). */
export function currentGeneration(): number {
  return _cancelGeneration;
}

/** How fast each model ran on this device, from its completions (none until it ran once): estimates use it first. */
const _observedSpeed: Partial<Record<AIModelId, { prefill: number; generate: number }>> = {};

function recordSpeed(modelId: AIModelId, timings: AITimings) {
  const known = _observedSpeed[modelId];
  // a short prompt or answer says little about the rate (fixed costs weigh most): only fair-sized ones count
  const prefill = timings.promptN >= 64 && timings.promptMs > 0 ? (timings.promptN * 1000) / timings.promptMs : null;
  const generate =
    timings.predictedN >= 16 && timings.predictedMs > 0 ? (timings.predictedN * 1000) / timings.predictedMs : null;
  if (prefill === null && generate === null) return;
  const blend = (previous: number | undefined, fresh: number | null, fallback: number) =>
    fresh === null ? (previous ?? fallback) : previous === undefined ? fresh : (previous + fresh) / 2;
  _observedSpeed[modelId] = {
    prefill: blend(known?.prefill, prefill, MODEL_SPEED[modelId].prefill),
    generate: blend(known?.generate, generate, MODEL_SPEED[modelId].generate),
  };
}

/** Tokens per second `modelId` reads and writes at: as measured on this device, or the reference phone's. */
export function getModelSpeed(modelId?: AIModelId): { prefill: number; generate: number } {
  const id = normalizeModelId(modelId ?? selectedModelId());
  return _observedSpeed[id] ?? MODEL_SPEED[id];
}

/**
 * Starts loading the model without waiting for it, where an action is likely to follow (the dictation sheet opens, the AI
 * menu opens): by the time the user taps, the load is done or under way.
 */
export function prewarmContext(modelId?: AIModelId): void {
  void initContext(modelId ?? selectedModelId());
}

export async function initContext(modelId?: AIModelId): Promise<boolean> {
  const targetId = normalizeModelId(modelId);

  // A load under way: shared if it's this model, waited for (then replaced) if it's another one.
  while (_initPromise) {
    if (_loadingModelId === targetId) return _initPromise;
    await _initPromise;
  }

  // If context exists but for a different model, release it first
  if (_context && _activeModelId !== targetId) {
    await releaseContext();
  }

  if (_context) return true;

  // Another caller may have started a load while this one released.
  if (_initPromise) return initContext(targetId);

  if (!isNativeModuleAvailable()) {
    console.warn("[AI] Native module not available. Rebuild the app with: npx expo run:android");
    notifyListeners("error");
    return false;
  }

  _loadingModelId = targetId;
  _initPromise = (async () => {
    try {
      notifyListeners("loading");

      const modelPath = await getModelPath(targetId);
      const exists = await isModelDownloaded(targetId);

      if (!exists) {
        notifyListeners("error");
        return false;
      }

      const model = getModel(targetId);
      _context = await initLlama({
        model: modelPath,
        n_ctx: model.contextSize,
        n_gpu_layers: 99,
        use_mlock: model.useMlock,
      });

      _activeModelId = targetId;
      notifyListeners("ready");
      scheduleRelease();
      return true;
    } catch (error) {
      console.error("[AI] Init context failed:", error);
      _context = null;
      _activeModelId = null;
      notifyListeners("error");
      return false;
    } finally {
      _initPromise = null;
      _loadingModelId = null;
    }
  })();

  return _initPromise;
}

/** What the loaded model runs on (the eval report records it). Null with no model loaded. */
export function getContextInfo(): { gpu: boolean; reasonNoGPU: string; devices?: unknown; androidLib?: unknown } | null {
  if (!_context) return null;
  return {
    gpu: _context.gpu,
    reasonNoGPU: _context.reasonNoGPU,
    devices: _context.devices,
    androidLib: _context.androidLib,
  };
}

/** Stops the running completion, and any queued or loading run started before this call. */
export async function cancelCommand(): Promise<void> {
  _cancelGeneration++;
  if (_context) {
    try {
      await _context.stopCompletion();
    } catch {
      // Ignore if no completion is running
    }
  }
}

export async function releaseContext(): Promise<void> {
  clearIdleRelease();
  // A load under way would otherwise finish after the release and keep the model (switching models, turning the AI off).
  if (_initPromise) await _initPromise;
  if (_context) {
    // Detached first: an action starting during the release loads a fresh context instead of using this one.
    const context = _context;
    _activeModelId = null;
    _context = null;
    try {
      if (_busy > 0) await context.stopCompletion();
      await context.release();
    } catch {
      // Ignore release errors
    }
    notifyListeners("idle");
  }
}

function timingsOf(timings: { prompt_n: number; prompt_ms: number; predicted_n: number; predicted_ms: number }): AITimings {
  return {
    promptN: timings.prompt_n,
    promptMs: timings.prompt_ms,
    predictedN: timings.predicted_n,
    predictedMs: timings.predicted_ms,
  };
}

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
  "<|endoftext|>",
];

/**
 * Every completion goes through the model's own chat template (jinja) with thinking off: Qwen3.5 4B thinks by default, and a
 * reasoning block would eat a title's whole budget.
 */
const CHAT_TEMPLATE = { jinja: true, enable_thinking: false, reasoning_format: "none" } as const;

/**
 * Generate content for in-editor AI actions (title, summary, rewrites, category suggestion, item suggestions, dictation
 * cleanup).
 */
export function generateEditorContent(
  action: EditorAction,
  content: string,
  onToken?: (token: string) => void,
  options: EditorActionOptions = {}
): Promise<EditorActionResult> {
  const generation = options.generation ?? _cancelGeneration;
  return whileBusy(() => runEditorAction(action, content, onToken, options, generation));
}

/** How much a rewrite may write, in tokens per input token (room for the whole text, not for a runaway). */
const REWRITE_TOKEN_FACTOR: Partial<Record<EditorAction, number>> = {
  clean_transcript: 1.6,
  fix_grammar: 1.6,
  translate: 2,
  shorten: 1,
  transcript_to_items: 1.5,
};

async function runEditorAction(
  action: EditorAction,
  content: string,
  onToken: ((token: string) => void) | undefined,
  options: EditorActionOptions,
  generation: number
): Promise<EditorActionResult> {
  const cancelled = () => generation !== _cancelGeneration;
  if (cancelled()) return { success: false, error: "cancelled" };

  // Always the model asked for: a context loaded for another one (switched in the settings meanwhile) is replaced.
  const initialized = await initContext(options.modelId ?? selectedModelId());
  if (!initialized) {
    return { success: false, error: "Model not ready" };
  }
  if (cancelled() || !_context) return { success: false, error: "cancelled" };
  const context = _context;
  const model = getModel(_activeModelId ?? undefined);

  const langCode = options.lang ?? resolveLanguage();
  const isJsonOutput = action === "suggest_items" || action === "transcript_to_items";

  // Cap input length for gist-only actions so long notes don't blow up prefill latency.
  content = truncateForAction(action, content);

  // For suggest_category, build a user message with category list
  let categoryNames: string[] = [];
  if (action === "suggest_category") {
    categoryNames = (options.categories ?? store.getState().categories.items.map((c: { name: string }) => c.name)).filter(
      (name) => name.trim()
    );
    if (categoryNames.length === 0) return { success: false, error: "no_category_match" };
    content = `Categories: ${categoryNames.join(", ")}\n\nNote:\n${content}`;
  }

  try {
    const systemPrompt = getEditorSystemPrompt(action, langCode, model.id);

    // A rewrite gets room for the whole text (a long dictation outgrows a fixed budget), within the context's size.
    let nPredict = ACTION_MAX_TOKENS[action];
    const factor = REWRITE_TOKEN_FACTOR[action];
    if (factor) {
      const inputTokens = (await context.tokenize(content)).tokens.length;
      const room = model.contextSize - inputTokens - 256;
      nPredict = Math.max(64, Math.min(room, Math.max(nPredict, Math.ceil(inputTokens * factor) + 32)));
    }
    if (cancelled()) return { success: false, error: "cancelled" };

    let stopping = false;
    const result = await context.completion(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        ...CHAT_TEMPLATE,
        n_predict: nPredict,
        stop: STOP_WORDS,
        ...ACTION_SAMPLING[action],
        ...(isJsonOutput ? { grammar: JSON_ARRAY_GRAMMAR } : {}),
        // the candidates of each token tell how close another category came
        ...(action === "suggest_category" ? { grammar: categoryGrammar(categoryNames), n_probs: 10 } : {}),
      },
      (data) => {
        // a cancel that landed before the native completion began was dropped by it: stop at the first token
        if (cancelled()) {
          if (!stopping) {
            stopping = true;
            void context.stopCompletion();
          }
          return;
        }
        if (data.token && onToken) {
          onToken(data.token);
        }
      }
    );

    const timings = timingsOf(result.timings);
    recordSpeed(model.id, timings);
    // A stopped answer is cut short: never applied (a half list of items, half a category name).
    if (cancelled() || result.interrupted) return { success: false, error: "cancelled", timings };
    // So is one that ran out of room: a rewrite cut mid-way would replace the whole text with part of it. A part of a long
    // note's summary is the exception: only the merge reads it, and its complete sentences are enough.
    const cut = result.stopped_limit || result.truncated || result.context_full;
    if (cut && action !== "summarize_part") {
      return { success: false, error: factor ? "too_long" : "No response", timings };
    }
    const answer = stripThinking(result.text ?? "");
    const text = (cut ? completeSentences(answer) : answer).trim();
    if (!text) return { success: false, error: "No response", timings };

    if (isJsonOutput) {
      let raw: string[] | null = null;
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) raw = parsed.map(String);
      } catch {
        // Fallback: extract quoted strings
        const matches = text.match(/"([^"]+)"/g);
        if (matches) raw = matches.map((m) => m.replace(/"/g, ""));
      }
      if (!raw) return { success: false, error: "Invalid response format", timings };
      // suggestions leave out what the list (title, then one item per line) already has
      const items = cleanSuggestedItems(raw, action === "suggest_items" ? content.split("\n") : []);
      return items.length ? { success: true, items, timings } : { success: false, error: "No items", timings };
    }

    const cleaned = cleanAnswer(action, content, text);

    // The grammar lets the model answer only with a category name or "none" (a category named "none" wins).
    if (action === "suggest_category") {
      const matched =
        categoryNames.find((n) => n === text) ?? categoryNames.find((n) => n.toLowerCase() === text.toLowerCase());
      if (!matched) return { success: false, error: "no_category_match", timings };
      const temperature = ACTION_SAMPLING.suggest_category.temperature;
      const alternative = categoryAlternative(result.completion_probabilities ?? [], matched, categoryNames, temperature);
      return { success: true, text: matched, alternative, timings };
    }

    // A rewrite that lost half the text, or grew far beyond it, is not shown (the caller keeps the original).
    if (!isPlausibleRewrite(action, content, cleaned)) {
      console.log("[AI] Rewrite discarded:", action, content.length, "->", cleaned.length);
      return { success: false, error: "implausible_output", discarded: cleaned, timings };
    }

    return { success: true, text: cleaned, timings };
  } catch (error) {
    console.error("[AI] Editor content generation failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Map a natural-language question to the most relevant Help topics.
 *
 * The model is constrained (via grammar) to output only indices into
 * `catalog`, so it can never invent a topic — at worst it picks a real but
 * less-relevant entry. Returns the matching `base` keys ordered by relevance,
 * or an empty array on any failure so the caller can fall back to plain
 * keyword search.
 */
export async function searchHelpByIntent(query: string, catalog: HelpCatalogEntry[]): Promise<string[]> {
  if (!query.trim() || catalog.length === 0) return [];
  return whileBusy(() => runHelpSearch(query, catalog));
}

async function runHelpSearch(query: string, catalog: HelpCatalogEntry[]): Promise<string[]> {
  if (!(await initContext(selectedModelId())) || !_context) return [];
  const context = _context;

  const list = catalog.map((entry, i) => `${i}. ${entry.title}`).join("\n");
  const userContent = `Topics:\n${list}\n\nQuestion: ${query.trim()}`;

  try {
    const result = await context.completion({
      messages: [
        { role: "system", content: HELP_SEARCH_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      ...CHAT_TEMPLATE,
      n_predict: 48,
      stop: STOP_WORDS,
      ...HELP_SEARCH_SAMPLING,
      grammar: JSON_INT_ARRAY_GRAMMAR,
    });

    const text = stripThinking(result.text ?? "").trim();
    if (!text) return [];

    let indices: number[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) indices = parsed.map(Number);
    } catch {
      // Grammar should prevent this, but tolerate stray output just in case.
      indices = (text.match(/\d+/g) ?? []).map(Number);
    }

    const seen = new Set<number>();
    const keys: string[] = [];
    for (const idx of indices) {
      if (Number.isInteger(idx) && idx >= 0 && idx < catalog.length && !seen.has(idx)) {
        seen.add(idx);
        keys.push(catalog[idx].base);
        if (keys.length >= 6) break;
      }
    }
    return keys;
  } catch (error) {
    console.error("[AI] Help search failed:", error);
    return [];
  }
}

// a download the app was closed during goes on: picked up now, and each time the app comes back
void resumeModelDownload(true);
AppState.addEventListener("change", (state) => {
  if (state === "active") void resumeModelDownload(false);
});
