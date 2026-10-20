import type { AppIconName } from "@/constants/app-icons";

// A browser tab or the desktop app has no launcher icon to change.
export const supportsAppIcons = false;

export const appIconClosesApp = false;

export const getAppIcon = (): AppIconName | null => null;

export const setAppIcon = (_name: AppIconName | null): Promise<void> => Promise.resolve();
