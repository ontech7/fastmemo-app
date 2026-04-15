import * as FileSystem from "expo-file-system";
import { initLlama, type LlamaContext } from "llama.rn";
import { NativeModules } from "react-native";

import { AI_MODELS, DEFAULT_MODEL_ID, JSON_GRAMMAR, getSystemPrompt } from "./constants";
import { tryParseJSON } from "./helpers";
import { store } from "@/slicers/store";
import type { AIModelId, AIModelInfo, AIModelStatus, AIResponse, AIToolCall } from "./types";

type StatusListener = (status: AIModelStatus, progress?: number) => void;

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

export async function isModelDownloaded(modelId?: AIModelId): Promise<boolean> {
  const path = getModelPath(modelId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

let _activeDownload: FileSystem.DownloadResumable | null = null;

export async function downloadModel(modelId?: AIModelId, onProgress?: (progress: number) => void): Promise<boolean> {
  const targetId = modelId || DEFAULT_MODEL_ID;
  const model = getModel(targetId);

  try {
    // Cancel any existing download
    if (_activeDownload) {
      try {
        await _activeDownload.cancelAsync();
      } catch {
        /* ignore */
      }
      _activeDownload = null;
    }

    notifyListeners("downloading", 0);

    // Delete other models to save space (only one model at a time)
    const allModelIds = Object.keys(AI_MODELS) as AIModelId[];
    for (const otherId of allModelIds) {
      if (otherId !== targetId) {
        const otherPath = getModelPath(otherId);
        const otherInfo = await FileSystem.getInfoAsync(otherPath);
        if (otherInfo.exists) {
          await releaseContext();
          await FileSystem.deleteAsync(otherPath);
        }
      }
    }

    const dirPath = `${FileSystem.documentDirectory}models`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    const modelPath = getModelPath(targetId);

    _activeDownload = FileSystem.createDownloadResumable(model.url, modelPath, {}, (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesExpectedToWrite > 0
          ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          : 0;
      notifyListeners("downloading", progress);
      onProgress?.(progress);
    });

    const result = await _activeDownload.downloadAsync();
    _activeDownload = null;

    if (result?.uri) {
      notifyListeners("idle");
      return true;
    }

    notifyListeners("error");
    return false;
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

    // Clean up partial file for all models
    const allModelIds = Object.keys(AI_MODELS) as AIModelId[];
    for (const id of allModelIds) {
      const modelPath = getModelPath(id);
      const info = await FileSystem.getInfoAsync(modelPath);
      if (info.exists && info.size && info.size < 1000000) {
        // Partial file (less than 1MB) - remove it
        await FileSystem.deleteAsync(modelPath);
      }
    }

    notifyListeners("idle");
  }
}

export async function deleteModel(modelId?: AIModelId): Promise<void> {
  try {
    await releaseContext();
    const modelPath = getModelPath(modelId);
    const info = await FileSystem.getInfoAsync(modelPath);
    if (info.exists) {
      await FileSystem.deleteAsync(modelPath);
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

      _context = await initLlama({
        model: modelPath,
        n_ctx: 4096,
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

const HELP_PATTERNS = [
  /\b(cosa (sai|puoi) fare)\b/i,
  /\b(che cosa (sai|puoi) fare)\b/i,
  /\b(what can you do)\b/i,
  /\b(what do you do)\b/i,
  /\bhelp\b/i,
  /\baiut[oa]\b/i,
  /\bhilfe\b/i,
  /\bayuda\b/i,
  /\baide\b/i,
];

function isHelpRequest(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  // Short messages that are clearly help requests
  if (trimmed.length < 40) {
    return HELP_PATTERNS.some((p) => p.test(trimmed));
  }
  return false;
}

export async function processCommand(userMessage: string, onToken?: (token: string) => void): Promise<AIResponse> {
  // Intercept help requests client-side (more reliable than LLM classification)
  if (isHelpRequest(userMessage)) {
    return { success: true, toolCall: { action: "show_help", params: {} } };
  }

  if (!_context) {
    const initialized = await initContext();
    if (!initialized) {
      return { success: false, error: "Model not ready" };
    }
  }

  try {
    const stopWords = [
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

    const result = await _context!.completion(
      {
        messages: [
          { role: "system", content: getSystemPrompt(store.getState().settings.language || "en") },
          { role: "user", content: userMessage },
        ],
        n_predict: 300,
        stop: stopWords,
        temperature: 0.05,
        top_p: 0.85,
        penalty_repeat: 1.3,
        dry_multiplier: 0.8,
        dry_base: 1.75,
        dry_allowed_length: 2,
        grammar: JSON_GRAMMAR,
      },
      (data) => {
        if (data.token && onToken) {
          onToken(data.token);
        }
      }
    );

    console.log("[AI] Raw result:", JSON.stringify(result, null, 2));

    const text = result.text?.trim();

    if (!text) {
      return { success: false, error: "No response from model" };
    }

    const parsed = tryParseJSON(text);

    if (!parsed) {
      console.error("[AI] Failed to parse response:", text);
      return { success: false, error: "Invalid JSON response" };
    }

    console.log("[AI] Parsed JSON:", parsed);

    if (!parsed.action) {
      return { success: false, error: "Missing action in response" };
    }

    const { action, ...params } = parsed;

    const toolCall: AIToolCall = { action: action as string, params };
    return { success: true, toolCall };
  } catch (error) {
    console.error("[AI] Completion failed:", error);
    return { success: false, error: String(error) };
  }
}
