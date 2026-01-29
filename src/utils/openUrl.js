import { Linking } from "react-native";

// @ts-ignore - __TAURI__ is injected by Tauri runtime
const isTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Opens a URL in the default browser.
 * Uses Tauri shell.open on desktop, Linking.openURL on mobile/web.
 * @param {string} url - The URL to open
 */
export async function openUrl(url) {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/api/shell");
    await open(url);
  } else {
    await Linking.openURL(url);
  }
}
