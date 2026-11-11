import { flushNow } from "@/libs/flushOnExit";
import { isTauri } from "@/utils/platform";

/** The desktop's quit waits no longer for the writes either (flushOnExit's EXIT_FLUSH_TIMEOUT_MS). */
const FLUSH_TIMEOUT_MS = 1800;

/**
 * Loads the app again from its root, not from the address that crashed (the crash screen's "Reopen"). On the desktop the
 * app is restarted instead: reloading the page while a Tauri command is answering can abort the process (measured on
 * macOS 2026-11-11, about one reload in three, on 4.0.0's page too). The restart doesn't go through the exit flush, so
 * pending writes are started first, as before an update's restart (`desktopUpdater.web.ts`); a store that is what broke
 * must not stop the restart.
 */
export async function reloadApp(): Promise<void> {
  if (!isTauri()) {
    window.location.replace("/");
    return;
  }
  try {
    await Promise.race([flushNow(), new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS))]);
  } catch {
    // The restart matters more than a write that failed.
  }
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
