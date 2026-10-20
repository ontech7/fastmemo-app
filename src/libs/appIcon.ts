import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";

import type { AppIconName } from "@/constants/app-icons";

// The OS keeps the chosen icon (the alternate icon on iOS, an activity alias on Android): it is the only source of truth.
export const supportsAppIcons = supportsAlternateIcons;

/** iOS switches the icon in place, with a system alert. */
export const appIconClosesApp = false;

export const getAppIcon = (): AppIconName | null => getAppIconName() as AppIconName | null;

/** `null` goes back to the default icon. */
export const setAppIcon = async (name: AppIconName | null): Promise<void> => {
  await setAlternateAppIcon(name);
};
