import { isTauri } from "@/utils/platform";
import { Linking } from "react-native";

/**
 * Opens a URL in the default browser.
 * Uses the Tauri opener plugin on desktop, Linking.openURL on mobile/web.
 */
export async function openUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl: openWithDefaultApp } = await import("@tauri-apps/plugin-opener");
    await openWithDefaultApp(url);
  } else {
    await Linking.openURL(url);
  }
}
