import type { AIModelId, DownloadFailure, ModelDownloadProgress } from "./types";

// No model files on the web yet: the desktop ones come with their own implementation.

export async function getModelPath(_modelId?: AIModelId): Promise<string> {
  return "";
}

export async function isModelDownloaded(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function getOrphanedModelFiles(): Promise<{ dir: string; fileName: string; size: number }[]> {
  return [];
}

export async function deleteOrphanedModelFiles(): Promise<number> {
  return 0;
}

export async function deleteModelFiles(_modelId: AIModelId): Promise<void> {}

export async function downloadModel(_modelId?: AIModelId): Promise<boolean> {
  return false;
}

export async function cancelDownload(): Promise<void> {}

export function getModelDownload(): ModelDownloadProgress | null {
  return null;
}

export function getDownloadFailure(): DownloadFailure | null {
  return null;
}
