import { isTauri } from "@/utils/platform";

// The longest the window waits for Geist: the first screen would otherwise show in the fallback font for a moment.
const FONT_WAIT_MS = 300;

let sent = false;

/**
 * Desktop: the window opens hidden and shows once the first screen is drawn (`window_ready` in `src-tauri/src/lib.rs`),
 * instead of an empty dark window while the app loads. Once per launch; a no-op in the browser.
 */
export function windowReady(): void {
  if (sent || !isTauri()) return;
  sent = true;
  Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))])
    .then(() => import("@tauri-apps/api/core"))
    .then(({ invoke }) => invoke("window_ready"))
    .catch(() => {});
}
