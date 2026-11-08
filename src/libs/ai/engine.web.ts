import { flushNow } from "@/libs/flushOnExit";
import { isTauri } from "@/utils/platform";
import type { EngineCompletionParams, EngineCompletionResult, EngineContext, EngineLoadParams, EngineSupport } from "./types";

// The desktop's engine: llama.cpp in the Tauri shell (`src-tauri/src/ai/`), reached through its commands. A plain browser
// has none.

/** What the context logs when it can't load a model for want of the engine. */
export const ENGINE_UNAVAILABLE_WARNING = "[AI] Engine not available on this platform";

/** This page load's id: Rust outlives a reload, and the model a page before loaded is not this page's to trust. */
const PAGE_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const tauriCore = () => import("@tauri-apps/api/core");

/** What `ai_load` answers. */
interface LoadInfo {
  gpu: boolean;
  reasonNoGpu: string;
  devices: string[];
}

/** What `ai_info` answers. */
interface EngineInfo {
  available: boolean;
  reason?: EngineSupport["reason"];
  totalMemory: number | null;
}

export function isEngineAvailable(): boolean {
  return isTauri();
}

let _support: EngineSupport | null = null;

/** Whether the engine library loads here and the computer's memory: asked once, and only an answer is kept (a failed call is asked again). */
export async function getEngineSupport(): Promise<EngineSupport> {
  if (!isTauri()) return { available: false, totalMemory: null, reason: "missing" };
  if (_support) return _support;
  try {
    const { invoke } = await tauriCore();
    const info = await invoke<EngineInfo>("ai_info");
    _support = { available: info.available, totalMemory: info.totalMemory ?? null, reason: info.reason };
    return _support;
  } catch (error) {
    console.error("[AI] Engine info failed:", error);
    return { available: false, totalMemory: null, reason: "error" };
  }
}

/** Loads a model (the bare file name of the models folder) in the shell. */
export async function loadEngine(params: EngineLoadParams): Promise<EngineContext> {
  const { invoke, Channel } = await tauriCore();
  const info = await invoke<LoadInfo>("ai_load", {
    fileName: params.model,
    nCtx: params.n_ctx,
    nGpuLayers: params.n_gpu_layers,
    pageId: PAGE_ID,
  });
  return {
    gpu: info.gpu,
    reasonNoGPU: info.reasonNoGpu,
    devices: info.devices,
    tokenize: async (text) => ({ tokens: await invoke<number[]>("ai_tokenize", { text }) }),
    completion: async (completionParams: EngineCompletionParams, onToken) => {
      // The note being edited is committed to the store before the model reads it.
      await flushNow();
      const channel = new Channel<string>();
      channel.onmessage = (token) => onToken?.({ token });
      return invoke<EngineCompletionResult>("ai_complete", { params: completionParams, onToken: channel });
    },
    stopCompletion: () => invoke<void>("ai_stop"),
    release: () => invoke<void>("ai_release"),
  };
}
