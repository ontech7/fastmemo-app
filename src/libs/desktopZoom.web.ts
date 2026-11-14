import i18n from "@/libs/i18n";
import { nextZoom } from "@/libs/zoomSteps";
import { selectorDesktopZoom, setDesktopZoom } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import { isTauri } from "@/utils/platform";
import { toast } from "@/utils/toast";

import type { RootState } from "@/types";

/*
 * The desktop window's zoom (spec C.4): Ctrl/Cmd + and - step through `ZOOM_STEPS`, Ctrl/Cmd + 0 goes back to 100. A
 * setting of this device (`settings.desktopZoom`), applied again at start before the window shows (`windowReady`).
 */

/** Sets the webview's zoom. */
export async function applyZoom(percent: number): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().setZoom(percent / 100);
}

/** The longest the start waits for the page to be drawn again at the zoom it keeps. */
const ZOOM_SETTLE_MS = 300;
/** The moment between the page's resize and the frame drawn at its new size. */
const DRAW_MS = 50;

/**
 * The page laid out and drawn at a new zoom: its width changes (a resize), then a moment for the frame. `setZoom` answers
 * before that, and a window shown then appears for a frame at the old size.
 */
function redrawn(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(cap);
      resolve();
    };
    const onResize = () => setTimeout(done, DRAW_MS);
    const cap = setTimeout(done, ZOOM_SETTLE_MS);
    window.addEventListener("resize", onResize);
  });
}

/** The zoom this device keeps, applied once at start, before the window shows; 100 isn't applied at all. */
export async function applyStoredZoom(): Promise<void> {
  const percent = selectorDesktopZoom(store.getState() as RootState);
  if (percent === 100) return;
  const drawn = redrawn();
  await applyZoom(percent).catch(() => {});
  await drawn;
}

/** A zoom key or menu item: the new zoom is kept, applied and shown. */
export function zoom(direction: "in" | "out" | "reset"): void {
  const current = selectorDesktopZoom(store.getState() as RootState);
  const percent = direction === "reset" ? 100 : nextZoom(current, direction);
  store.dispatch(setDesktopZoom(percent));
  void applyZoom(percent).catch(() => {});
  toast(i18n.t("generalsettings.zoom_value", { percent }));
}
