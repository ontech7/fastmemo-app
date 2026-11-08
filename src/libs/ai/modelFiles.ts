import { selectorAIAssistant, setAIAssistant } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import type { RootState } from "@/types";
import { AI_MODELS, getModel, normalizeModelId } from "./constants";
import type { AIModelId } from "./types";

// What `models` (the phone's) and `models.web` (the desktop's) share: which files make up a model, and what a finished
// download does to the settings. Nothing here touches a file system.

/** One file of a model. `sha256` is the main file's: a part has none pinned. */
export interface ModelFile {
  fileName: string;
  url: string;
  sizeBytes: number;
  sha256?: string;
}

/** Every file of `modelId`: the model itself, then its parts. */
export function getAllModelFiles(modelId?: AIModelId): ModelFile[] {
  const model = getModel(modelId);
  return [
    { fileName: model.fileName, url: model.url, sizeBytes: model.sizeBytes, sha256: model.sha256 },
    ...(model.parts ?? []),
  ];
}

/** Every file the catalog downloads, with its size: anything else in a models folder is a leftover. */
export function catalogSizes(): Map<string, number> {
  return new Map(
    (Object.keys(AI_MODELS) as AIModelId[]).flatMap((id) => getAllModelFiles(id).map((f) => [f.fileName, f.sizeBytes]))
  );
}

/** A finished download asks for the AI: switching models turned it off, the download turns it back on. */
export function downloaded(modelId: AIModelId): void {
  const ai = selectorAIAssistant(store.getState() as RootState);
  if (normalizeModelId(ai.selectedModel) === modelId) {
    store.dispatch(setAIAssistant({ ...ai, modelDownloaded: true, enabled: true }));
  }
}
