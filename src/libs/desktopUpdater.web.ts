import { isTauri } from "@/utils/platform";

// Web/Tauri build. Mobile uses the `desktopUpdater.ts` sibling, so the Tauri plugins never reach the React Native bundle.

export interface DesktopUpdate {
  version: string;
  download(): Promise<void>;
  install(): Promise<void>;
  close(): Promise<void>;
}

/**
 * A newer signed desktop build, or null (also outside Tauri, and for deb/rpm installs: those update through their package
 * manager, and the updater would only offer them an AppImage it can't install). Rejects when the check fails.
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdate | null> {
  if (!isTauri()) return null;
  const { BundleType, getBundleType } = await import("@tauri-apps/api/app");
  const bundleType = await getBundleType();
  if (bundleType === BundleType.Deb || bundleType === BundleType.Rpm) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
}

/**
 * Downloads and installs `update`, then restarts the app. Neither the install (Windows quits for the installer) nor the
 * restart goes through the usual exit flush, so `flush` runs right before each: edits typed during the download are kept.
 */
export async function installDesktopUpdate(update: DesktopUpdate, flush: () => Promise<void>): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await update.download();
  await flush();
  await update.install();
  await flush();
  await relaunch();
}
