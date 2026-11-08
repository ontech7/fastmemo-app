import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_MODEL_ID } from "./platformConstants";
import type { AIModelId } from "./types";

// The desktop's default model is the 2B (platformConstants.web.ts); a desktop install that stored the old default (the
// 0.8B, from before the AI came to the computer) takes the new one once, if nothing was ever set up. Platform-free: the
// screen decides where it applies.

/** Set once the check ran: a later pick of the user's sticks. */
export const DEFAULT_MODEL_CHECKED_KEY = "@aiDefaultModelChecked";

/** The default the phone's setting started with, and what a desktop that never chose carries. */
const OLD_DEFAULT_MODEL_ID: AIModelId = "qwen3.5-0.8b";

/**
 * The model id to store, or null to leave the settings alone. The first time (the key absent) it answers the default if
 * no model file is on the computer, the AI is off and the stored model is the old default; the key is set whatever the
 * answer. A file check that throws is no answer: it throws too, with the key unset, and the next time asks again.
 */
export async function desktopDefaultModelToStore(
  ai: { enabled: boolean; selectedModel: string },
  hasAnyModelFile: () => Promise<boolean>
): Promise<AIModelId | null> {
  if ((await AsyncStorage.getItem(DEFAULT_MODEL_CHECKED_KEY)) !== null) return null;
  const candidate = !ai.enabled && ai.selectedModel === OLD_DEFAULT_MODEL_ID && DEFAULT_MODEL_ID !== OLD_DEFAULT_MODEL_ID;
  const replace = candidate && !(await hasAnyModelFile());
  await AsyncStorage.setItem(DEFAULT_MODEL_CHECKED_KEY, "1");
  return replace ? DEFAULT_MODEL_ID : null;
}
