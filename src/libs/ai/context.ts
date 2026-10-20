import * as FileSystem from "expo-file-system/legacy";
import * as Localization from "expo-localization";
import { initLlama, type LlamaContext } from "llama.rn";
import { AppState, NativeModules } from "react-native";

import { store } from "@/slicers/store";
import {
  ACTION_MAX_TOKENS,
  ACTION_SAMPLING,
  AI_MODELS,
  HELP_SEARCH_SAMPLING,
  HELP_SEARCH_SYSTEM_PROMPT,
  JSON_ARRAY_GRAMMAR,
  JSON_INT_ARRAY_GRAMMAR,
  getEditorSystemPrompt,
  normalizeModelId,
  truncateForAction,
} from "./constants";
import { cleanSuggestedItems, isPlausibleRewrite, stripThinking } from "./helpers";
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
function resolveLanguage(): string {
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
function selectedModelId(): AIModelId {
  return normalizeModelId(store.getState().settings.aiAssistant?.selectedModel);
}

function getModel(modelId?: AIModelId): AIModelInfo {
  return AI_MODELS[normalizeModelId(modelId)];
}

const MODELS_DIR = () => `${FileSystem.documentDirectory}models/`;

export function getModelPath(modelId?: AIModelId): string {
  return `${MODELS_DIR()}${getModel(modelId).fileName}`;
}

function getAllModelFiles(modelId?: AIModelId): { fileName: string; url: string; sizeBytes: number }[] {
  const model = getModel(modelId);
  return [{ fileName: model.fileName, url: model.url, sizeBytes: model.sizeBytes }, ...(model.parts ?? [])];
}

/** Every file name the catalog downloads: anything else in the models folder is a leftover. */
function catalogFileNames(): Set<string> {
  return new Set((Object.keys(AI_MODELS) as AIModelId[]).flatMap((id) => getAllModelFiles(id).map((f) => f.fileName)));
}

/** A model counts as downloaded only when every file is there at its exact size (a cut-off download is not). */
export async function isModelDownloaded(modelId?: AIModelId): Promise<boolean> {
  for (const file of getAllModelFiles(modelId)) {
    const info = await FileSystem.getInfoAsync(`${MODELS_DIR()}${file.fileName}`);
    if (!info.exists || info.size !== file.sizeBytes) return false;
  }
  return true;
}

/**
 * Files in the models folder that no model of today's catalog uses: the Qwen 2.5 models of earlier versions, and partial
 * downloads of anything else.
 */
export async function getOrphanedModelFiles(): Promise<{ fileName: string; size: number }[]> {
  const dir = MODELS_DIR();
  if (!(await FileSystem.getInfoAsync(dir)).exists) return [];
  const known = catalogFileNames();
  const orphans: { fileName: string; size: number }[] = [];
  for (const fileName of await FileSystem.readDirectoryAsync(dir)) {
    if (known.has(fileName)) continue;
    const info = await FileSystem.getInfoAsync(`${dir}${fileName}`);
    orphans.push({ fileName, size: info.exists ? (info.size ?? 0) : 0 });
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
      await FileSystem.deleteAsync(`${MODELS_DIR()}${orphan.fileName}`, { idempotent: true });
      freed += orphan.size;
    } catch (error) {
      console.error("[AI] Delete old model file failed:", error);
    }
  }
  return freed;
}

let _activeDownload: FileSystem.DownloadResumable | null = null;

export async function downloadModel(modelId?: AIModelId, onProgress?: (progress: number) => void): Promise<boolean> {
  const targetId = normalizeModelId(modelId);

  try {
    if (_activeDownload) {
      try {
        await _activeDownload.cancelAsync();
      } catch {
        /* ignore */
      }
      _activeDownload = null;
    }

    notifyListeners("downloading", 0);

    // One model on the device at a time: the others go, and so does anything left over (old models, partial files).
    await deleteOrphanedModelFiles();
    for (const otherId of Object.keys(AI_MODELS) as AIModelId[]) {
      if (otherId === targetId) continue;
      for (const file of getAllModelFiles(otherId)) {
        const p = `${MODELS_DIR()}${file.fileName}`;
        if ((await FileSystem.getInfoAsync(p)).exists) {
          await releaseContext();
          await FileSystem.deleteAsync(p);
        }
      }
    }

    const dirPath = MODELS_DIR();
    if (!(await FileSystem.getInfoAsync(dirPath)).exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    const files = getAllModelFiles(targetId);
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const filePath = `${MODELS_DIR()}${file.fileName}`;

      _activeDownload = FileSystem.createDownloadResumable(file.url, filePath, {}, (dp) => {
        const fileProgress = dp.totalBytesExpectedToWrite > 0 ? dp.totalBytesWritten / dp.totalBytesExpectedToWrite : 0;
        const overall = (i + fileProgress) / totalFiles;
        notifyListeners("downloading", overall);
        onProgress?.(overall);
      });

      const result = await _activeDownload.downloadAsync();
      _activeDownload = null;

      // A file of another size is cut off or not the one pinned: never load it.
      const info = result?.uri ? await FileSystem.getInfoAsync(filePath) : null;
      if (!info?.exists || info.size !== file.sizeBytes) {
        console.error("[AI] Download incomplete:", file.fileName, info?.exists ? info.size : "missing");
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        notifyListeners("error");
        return false;
      }
    }

    notifyListeners("idle");
    return true;
  } catch (error) {
    _activeDownload = null;
    // Don't log cancellation as error
    if (String(error).includes("cancel")) {
      notifyListeners("idle");
      return false;
    }
    console.error("[AI] Download failed:", error);
    notifyListeners("error");
    return false;
  }
}

export async function cancelDownload(): Promise<void> {
  if (_activeDownload) {
    try {
      await _activeDownload.cancelAsync();
    } catch {
      /* ignore */
    }
    _activeDownload = null;

    // What the download left: a catalog file short of its size, and anything outside the catalog.
    for (const id of Object.keys(AI_MODELS) as AIModelId[]) {
      for (const file of getAllModelFiles(id)) {
        const p = `${MODELS_DIR()}${file.fileName}`;
        const info = await FileSystem.getInfoAsync(p);
        if (info.exists && info.size !== file.sizeBytes) await FileSystem.deleteAsync(p, { idempotent: true });
      }
    }
    await deleteOrphanedModelFiles();
    notifyListeners("idle");
  }
}

export async function deleteModel(modelId?: AIModelId): Promise<void> {
  try {
    await releaseContext();
    for (const file of getAllModelFiles(modelId)) {
      const p = `${MODELS_DIR()}${file.fileName}`;
      const info = await FileSystem.getInfoAsync(p);
      if (info.exists) await FileSystem.deleteAsync(p);
    }
    notifyListeners("idle");
  } catch (error) {
    console.error("[AI] Delete model failed:", error);
  }
}

let _activeModelId: AIModelId | null = null;

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

/** Runs `work` with the context marked busy, then restarts the idle countdown. */
async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
  _busy++;
  clearIdleRelease();
  try {
    return await work();
  } finally {
    _busy--;
    scheduleRelease();
  }
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

  // If context exists but for a different model, release it first
  if (_context && _activeModelId !== targetId) {
    await releaseContext();
  }

  if (_context) return true;

  // Prevent concurrent init calls (mutex via promise)
  if (_initPromise) return _initPromise;

  if (!isNativeModuleAvailable()) {
    console.warn("[AI] Native module not available. Rebuild the app with: npx expo run:android");
    notifyListeners("error");
    return false;
  }

  _initPromise = (async () => {
    try {
      notifyListeners("loading");

      const modelPath = getModelPath(targetId);
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

export async function cancelCommand(): Promise<void> {
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
  if (_context) {
    // Detached first: an action starting during the release loads a fresh context instead of using this one.
    const context = _context;
    _activeModelId = null;
    _context = null;
    try {
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
  return whileBusy(() => runEditorAction(action, content, onToken, options));
}

async function runEditorAction(
  action: EditorAction,
  content: string,
  onToken: ((token: string) => void) | undefined,
  options: EditorActionOptions
): Promise<EditorActionResult> {
  if (!_context) {
    const initialized = await initContext(selectedModelId());
    if (!initialized) {
      return { success: false, error: "Model not ready" };
    }
  }

  const langCode = options.lang ?? resolveLanguage();
  const isJsonOutput = action === "suggest_items" || action === "transcript_to_items";

  // Cap input length for gist-only actions so long notes don't blow up prefill latency.
  content = truncateForAction(action, content);

  // For suggest_category, build a user message with category list
  let categoryNames: string[] = [];
  if (action === "suggest_category") {
    categoryNames = options.categories ?? store.getState().categories.items.map((c: { name: string }) => c.name);
    content = `Categories: ${categoryNames.join(", ")}\n\nNote:\n${content}`;
  }

  try {
    const systemPrompt = getEditorSystemPrompt(action, langCode, _activeModelId ?? undefined);

    const result = await _context!.completion(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        ...CHAT_TEMPLATE,
        n_predict: ACTION_MAX_TOKENS[action],
        stop: STOP_WORDS,
        ...ACTION_SAMPLING[action],
        ...(isJsonOutput ? { grammar: JSON_ARRAY_GRAMMAR } : {}),
      },
      (data) => {
        if (data.token && onToken) {
          onToken(data.token);
        }
      }
    );

    const timings = timingsOf(result.timings);
    const text = stripThinking(result.text ?? "").trim();
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

    // Clean common artifacts from free-text output (multilingual prefixes)
    const cleaned = text
      .replace(/^["']|["']$/g, "")
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/^(Title|Titolo|Titel|Titulo|Titre|タイトル|标题)\s*:\s*/i, "")
      .replace(/^(Summary|Riassunto|Zusammenfassung|Resumen|Resume|要約|摘要)\s*:\s*/i, "")
      .replace(/^(Continuation|Continuazione|Fortsetzung|Continuacion|Suite|続き|续写)\s*:\s*/i, "")
      .trim();

    // For suggest_category, match model output to a real category name
    if (action === "suggest_category") {
      const lowerCleaned = cleaned.toLowerCase();

      if (lowerCleaned === "none" || lowerCleaned.startsWith("none")) {
        return { success: false, error: "no_category_match", timings };
      }

      // Exact match, then includes match
      const matched =
        categoryNames.find((n) => n.toLowerCase() === lowerCleaned) ||
        categoryNames.find((n) => lowerCleaned.includes(n.toLowerCase())) ||
        categoryNames.find((n) => n.toLowerCase().includes(lowerCleaned));
      if (matched) {
        return { success: true, text: matched, timings };
      }

      return { success: false, error: "no_category_match", timings };
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
  if (!_context) {
    const initialized = await initContext(selectedModelId());
    if (!initialized) return [];
  }

  const list = catalog.map((entry, i) => `${i}. ${entry.title}`).join("\n");
  const userContent = `Topics:\n${list}\n\nQuestion: ${query.trim()}`;

  try {
    const result = await _context!.completion({
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
