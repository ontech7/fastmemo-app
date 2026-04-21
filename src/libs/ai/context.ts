import * as FileSystem from "expo-file-system";
import * as Localization from "expo-localization";
import { initLlama, type LlamaContext } from "llama.rn";
import { NativeModules } from "react-native";

import { store } from "@/slicers/store";
import { AI_MODELS, DEFAULT_MODEL_ID, JSON_ARRAY_GRAMMAR, getEditorSystemPrompt } from "./constants";
import type { AIModelId, AIModelInfo, AIModelStatus, EditorAction, EditorActionResult } from "./types";

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

function getModel(modelId?: AIModelId): AIModelInfo {
  return AI_MODELS[modelId || DEFAULT_MODEL_ID];
}

export function getModelPath(modelId?: AIModelId): string {
  return `${FileSystem.documentDirectory}models/${getModel(modelId).fileName}`;
}

function getAllModelFiles(modelId?: AIModelId): { fileName: string; url: string }[] {
  const model = getModel(modelId);
  const files = [{ fileName: model.fileName, url: model.url }];
  if (model.parts) files.push(...model.parts);
  return files;
}

export async function isModelDownloaded(modelId?: AIModelId): Promise<boolean> {
  const files = getAllModelFiles(modelId);
  for (const file of files) {
    const path = `${FileSystem.documentDirectory}models/${file.fileName}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return false;
  }
  return true;
}

let _activeDownload: FileSystem.DownloadResumable | null = null;

export async function downloadModel(modelId?: AIModelId, onProgress?: (progress: number) => void): Promise<boolean> {
  const targetId = modelId || DEFAULT_MODEL_ID;

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

    const allModelIds = Object.keys(AI_MODELS) as AIModelId[];
    for (const otherId of allModelIds) {
      if (otherId !== targetId) {
        const otherFiles = getAllModelFiles(otherId);
        for (const file of otherFiles) {
          const p = `${FileSystem.documentDirectory}models/${file.fileName}`;
          const info = await FileSystem.getInfoAsync(p);
          if (info.exists) {
            await releaseContext();
            await FileSystem.deleteAsync(p);
          }
        }
      }
    }

    const dirPath = `${FileSystem.documentDirectory}models`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    const files = getAllModelFiles(targetId);
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const filePath = `${FileSystem.documentDirectory}models/${file.fileName}`;

      _activeDownload = FileSystem.createDownloadResumable(file.url, filePath, {}, (dp) => {
        const fileProgress = dp.totalBytesExpectedToWrite > 0 ? dp.totalBytesWritten / dp.totalBytesExpectedToWrite : 0;
        const overall = (i + fileProgress) / totalFiles;
        notifyListeners("downloading", overall);
        onProgress?.(overall);
      });

      const result = await _activeDownload.downloadAsync();
      _activeDownload = null;

      if (!result?.uri) {
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

    const allModelIds = Object.keys(AI_MODELS) as AIModelId[];
    for (const id of allModelIds) {
      for (const file of getAllModelFiles(id)) {
        const p = `${FileSystem.documentDirectory}models/${file.fileName}`;
        const info = await FileSystem.getInfoAsync(p);
        if (info.exists && info.size && info.size < 1000000) {
          await FileSystem.deleteAsync(p);
        }
      }
    }
    notifyListeners("idle");
  }
}

export async function deleteModel(modelId?: AIModelId): Promise<void> {
  try {
    await releaseContext();
    for (const file of getAllModelFiles(modelId)) {
      const p = `${FileSystem.documentDirectory}models/${file.fileName}`;
      const info = await FileSystem.getInfoAsync(p);
      if (info.exists) await FileSystem.deleteAsync(p);
    }
    notifyListeners("idle");
  } catch (error) {
    console.error("[AI] Delete model failed:", error);
  }
}

let _activeModelId: AIModelId | null = null;

export async function initContext(modelId?: AIModelId): Promise<boolean> {
  const targetId = modelId || DEFAULT_MODEL_ID;

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
        use_mlock: true,
      });

      _activeModelId = targetId;
      notifyListeners("ready");
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
  if (_context) {
    try {
      await _context.release();
    } catch {
      // Ignore release errors
    }
    _activeModelId = null;
    _context = null;
    notifyListeners("idle");
  }
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
 * Generate content for in-editor AI actions (title, summary, continuation, formatting,
 * category suggestion, item suggestions).
 */
export async function generateEditorContent(
  action: EditorAction,
  content: string,
  onToken?: (token: string) => void
): Promise<EditorActionResult> {
  if (!_context) {
    const settingsState = store.getState().settings;
    const modelId = (settingsState.aiAssistant?.selectedModel as AIModelId) || DEFAULT_MODEL_ID;
    const initialized = await initContext(modelId);
    if (!initialized) {
      return { success: false, error: "Model not ready" };
    }
  }

  const langCode = resolveLanguage();
  const isJsonOutput = action === "suggest_items";

  // For suggest_category, build a user message with category list
  let categoryNames: string[] = [];
  if (action === "suggest_category") {
    const categories = store.getState().categories.items;
    categoryNames = categories.map((c: { name: string }) => c.name);
    content = `Categories: ${categoryNames.join(", ")}\n\nNote title: ${content}`;
  }

  const nPredict =
    action === "generate_title" || action === "suggest_category"
      ? 30
      : action === "suggest_items"
        ? 100
        : action === "format_text" || action === "add_comments"
          ? 1500
          : action === "explain_code"
            ? 300
            : 200;

  const temperature =
    action === "generate_title" ? 0.05 : action === "continue_writing" ? 0.4 : action === "add_comments" ? 0.1 : 0.15;

  try {
    const systemPrompt = getEditorSystemPrompt(action, langCode);

    const result = await _context!.completion(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        n_predict: nPredict,
        stop: STOP_WORDS,
        temperature,
        top_p: 0.9,
        penalty_repeat: 1.2,
        ...(isJsonOutput ? { grammar: JSON_ARRAY_GRAMMAR } : {}),
      },
      (data) => {
        if (data.token && onToken) {
          onToken(data.token);
        }
      }
    );

    const text = result.text?.trim();
    if (!text) return { success: false, error: "No response" };

    if (isJsonOutput) {
      try {
        const items = JSON.parse(text);
        if (Array.isArray(items)) {
          return { success: true, items: items.map(String) };
        }
      } catch {
        // Fallback: extract quoted strings
        const matches = text.match(/"([^"]+)"/g);
        if (matches) {
          return { success: true, items: matches.map((m) => m.replace(/"/g, "")) };
        }
      }
      return { success: false, error: "Invalid response format" };
    }

    // For format_text, clean HTML wrappers and return as-is
    if (action === "format_text") {
      const html = text
        .replace(/^```html\s*/i, "")
        .replace(/```\s*$/g, "")
        .replace(/<\/?html[^>]*>/gi, "")
        .replace(/<\/?body[^>]*>/gi, "")
        .replace(/<\/?head[^>]*>/gi, "")
        .trim();
      return { success: true, text: html };
    }

    // For add_comments, strip code fences and return code with comments
    if (action === "add_comments") {
      const code = text
        .replace(/^```\w*\s*/i, "")
        .replace(/```\s*$/g, "")
        .trim();
      return { success: true, text: code };
    }

    // For explain_code, return as plain text
    if (action === "explain_code") {
      return { success: true, text: text.trim() };
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
        return { success: false, error: "no_category_match" };
      }

      // Exact match, then includes match
      const matched =
        categoryNames.find((n) => n.toLowerCase() === lowerCleaned) ||
        categoryNames.find((n) => lowerCleaned.includes(n.toLowerCase())) ||
        categoryNames.find((n) => n.toLowerCase().includes(lowerCleaned));
      if (matched) {
        return { success: true, text: matched };
      }

      return { success: false, error: "no_category_match" };
    }

    return { success: true, text: cleaned };
  } catch (error) {
    console.error("[AI] Editor content generation failed:", error);
    return { success: false, error: String(error) };
  }
}
