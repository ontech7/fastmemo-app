import { getAppIconName, setAlternateAppIcon } from "expo-alternate-app-icons";
import { AppState, BackHandler } from "react-native";

import type { AppIconName } from "@/constants/app-icons";
import { flushNow } from "@/libs/flushOnExit";

export const supportsAppIcons = true;

// The icon is an <activity-alias>: switching disables the alias the app runs from, and Android closes its window on the
// spot (measured on API 36, 2026-10-20). Waiting for the background isn't safe: an image picker or a share sheet sends
// the app there too, and the switch would then close it mid-task. So the user confirms, and the app closes right away.
export const appIconClosesApp = true;

export const getAppIcon = (): AppIconName | null => getAppIconName() as AppIconName | null;

/** `null` goes back to the default icon. Closes the app. */
export const setAppIcon = async (name: AppIconName | null): Promise<void> => {
  await flushNow();
  await setAlternateAppIcon(name);
  // Where the window survives the switch, its activity keeps the old alias's name, and the next switch would disable
  // that one instead of the enabled one (two icons): close it.
  setTimeout(() => {
    if (AppState.currentState === "active") BackHandler.exitApp();
  }, 500);
};
