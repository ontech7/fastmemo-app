import { flushPending } from "@/libs/registry";
import { persistor } from "@/slicers/store";
import { AppState } from "react-native";

/** Commits pending edits (see `registerPendingFlush`) and starts writing them right away. */
export function flushNow(): Promise<void> {
  flushPending();
  return persistor.flush();
}

/**
 * Once the app leaves the foreground its process may be killed at any time, and JS timers stop
 * firing: flush right away, rather than on the editors' or redux-persist's next tick.
 */
export function installFlushOnExit(): void {
  AppState.addEventListener("change", (state) => {
    if (state !== "active") flushNow();
  });
}
