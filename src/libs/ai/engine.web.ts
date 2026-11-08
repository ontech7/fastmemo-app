import type { EngineContext, EngineLoadParams, EngineSupport } from "./types";

// No engine on the web yet: the desktop one comes with its own implementation.

export function isEngineAvailable(): boolean {
  return false;
}

export async function getEngineSupport(): Promise<EngineSupport> {
  return { available: false, totalMemory: null, reason: "missing" };
}

export async function loadEngine(_params: EngineLoadParams): Promise<EngineContext> {
  throw new Error("AI not available on web");
}
