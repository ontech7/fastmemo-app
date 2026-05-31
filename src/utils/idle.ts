interface IdleHandle {
  cancel: () => void;
}

type RequestIdleCallback = (callback: () => void, options?: { timeout: number }) => number;
type CancelIdleCallback = (handle: number) => void;

/**
 * Defer non-urgent work until the JS thread is idle — the modern replacement for
 * the deprecated `InteractionManager.runAfterInteractions`. Returns a handle with
 * `cancel()`, matching the old API's `.cancel()` so call sites stay the same.
 *
 * Uses `requestIdleCallback` when available (React Native provides it; modern
 * browsers do too) and falls back to a `setTimeout` where it isn't (e.g. older
 * WebKit in the Tauri desktop webview), so it's safe across native/web/desktop.
 */
export function runWhenIdle(callback: () => void, timeout = 500): IdleHandle {
  const ric = (globalThis as { requestIdleCallback?: RequestIdleCallback }).requestIdleCallback;
  const cic = (globalThis as { cancelIdleCallback?: CancelIdleCallback }).cancelIdleCallback;

  if (typeof ric === "function") {
    const id = ric(callback, { timeout });
    return { cancel: () => cic?.(id) };
  }

  const id = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(id) };
}
