import { flushPending } from "@/libs/registry";
import { persistor } from "@/slicers/store";
import { isTauri } from "@/utils/platform";

// Never keep a closing desktop window open longer than this, even if a write hangs.
const CLOSE_FLUSH_TIMEOUT_MS = 2000;

/** Commits pending edits (see `registerPendingFlush`) and starts writing them right away. */
export function flushNow(): Promise<void> {
  flushPending();
  return persistor.flush();
}

/**
 * A hidden or closing page may never get to redux-persist's next write tick: flush right away.
 * Closing a desktop window doesn't reliably fire page events, so on Tauri the close waits for the
 * writes to finish.
 */
export function installFlushOnExit(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", () => {
    flushNow();
  });

  if (isTauri()) {
    import("@tauri-apps/api/window")
      .then(({ appWindow }) =>
        appWindow.onCloseRequested(() =>
          Promise.race([flushNow(), new Promise<void>((resolve) => setTimeout(resolve, CLOSE_FLUSH_TIMEOUT_MS))]).catch(
            () => {}
          )
        )
      )
      .catch(() => {});
  }
}
