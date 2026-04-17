import { isTauri } from "@/utils/platform";
import { Linking } from "react-native";

/**
 * Opens a URL in the default browser.
 * Uses Tauri shell.open on desktop, Linking.openURL on mobile/web.
 */
export async function openUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/api/shell");
    await open(url);
  } else {
    await Linking.openURL(url);
  }
}
