import { flushPending } from "@/libs/registry";
import { persistor } from "@/slicers/store";
import { isTauri } from "@/utils/platform";

// Never hold a desktop quit longer than this, even if a write hangs (the Rust shell gives up after 2s on its own).
const EXIT_FLUSH_TIMEOUT_MS = 1800;

/** Commits pending edits (see `registerPendingFlush`) and starts writing them right away. */
export function flushNow(): Promise<void> {
  flushPending();
  return persistor.flush();
}

/**
 * A hidden or closing page may never get to redux-persist's next write tick: flush right away.
 * Quitting the desktop app doesn't reliably fire page events, so on Tauri every quit (close button,
 * Cmd+Q) waits for the writes: the Rust shell asks for a flush and exits once told so
 * (`src-tauri/src/lib.rs`).
 */
export function installFlushOnExit(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", () => {
    flushNow();
  });

  if (isTauri()) {
    Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")])
      .then(([{ listen }, { invoke }]) =>
        listen("fastmemo://flush-before-exit", async () => {
          await Promise.race([flushNow(), new Promise<void>((resolve) => setTimeout(resolve, EXIT_FLUSH_TIMEOUT_MS))]).catch(
            () => {}
          );
          await invoke("exit_after_flush");
        })
      )
      .catch(() => {});
  }
}
