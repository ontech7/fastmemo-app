import * as FileSystem from "expo-file-system/legacy";
import { useEffect } from "react";

import { MODEL_DOWNLOAD_RECORD } from "@/libs/ai/constants";

/** Once the app is up: how long it waits before checking for a model download to pick up. */
const RESUME_DELAY_MS = 2000;

/**
 * An AI model download the app was closed during goes on in the system (ADR-028): when one is written down, the AI module
 * is loaded, and picks it up (finishing it if it ended meanwhile, so the AI is on). Without one, nothing loads: the AI module
 * isn't light, and the start is kept short (ADR-025).
 */
export function useModelDownloadResume() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if ((await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}${MODEL_DOWNLOAD_RECORD}`)).exists) {
          await import("@/libs/ai");
        }
      } catch {
        // the AI screen picks it up when opened
      }
    }, RESUME_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
}
