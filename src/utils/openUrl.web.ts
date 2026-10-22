import { isTauri } from "@/utils/platform";
import { Linking } from "react-native";

/**
 * Opens a URL in the default browser.
 * Uses the Tauri opener plugin in the desktop app, Linking.openURL in a browser (mobile: `openUrl.ts`).
 */
export async function openUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl: openWithDefaultApp } = await import("@tauri-apps/plugin-opener");
    await openWithDefaultApp(url);
  } else {
    await Linking.openURL(url);
  }
}
