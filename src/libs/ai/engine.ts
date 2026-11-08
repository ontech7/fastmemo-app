import * as Device from "expo-device";
import { initLlama } from "llama.rn";
import { NativeModules } from "react-native";

import type { EngineContext, EngineLoadParams, EngineSupport } from "./types";

/**
 * Check if the llama.rn native module is available.
 * Returns false when running in Expo Go or when the native build
 * hasn't been rebuilt after adding llama.rn.
 */
export function isEngineAvailable(): boolean {
  return NativeModules.RNLlama != null;
}

export async function getEngineSupport(): Promise<EngineSupport> {
  return { available: isEngineAvailable(), totalMemory: Device.totalMemory ?? null };
}

export const loadEngine = (params: EngineLoadParams): Promise<EngineContext> => initLlama(params);
