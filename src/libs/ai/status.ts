import type { AIModelStatus } from "./types";

type StatusListener = (status: AIModelStatus, progress?: number) => void;

let _status: AIModelStatus = "idle";
let _listeners: StatusListener[] = [];

export function notifyListeners(status: AIModelStatus, progress?: number) {
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

let _release: () => Promise<void> = async () => {};

/** The context registers how the loaded model is freed, so that `models` can free it before deleting files without importing the context. */
export function setModelRelease(release: () => Promise<void>): void {
  _release = release;
}

/** Frees the loaded model (a no-op until the context registers itself). */
export function releaseLoadedModel(): Promise<void> {
  return _release();
}
