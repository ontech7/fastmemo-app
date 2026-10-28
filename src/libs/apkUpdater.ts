import * as FileSystem from "expo-file-system/legacy";
import { AppState, NativeModules } from "react-native";

// The GitHub APK's updater (ADR-031). Its native half (modules-apk/fastmemo-installer) is linked only into that build: the
// Play build, and the web (`apkUpdater.web.ts`), have none.

interface FastmemoInstallerApi {
  canInstallAsync(): Promise<boolean>;
  openInstallSettingsAsync(): Promise<void>;
  installAsync(contentUri: string): Promise<void>;
}

const installer: FastmemoInstallerApi | undefined = NativeModules.FastmemoInstaller;

const APK_PATH = `${FileSystem.cacheDirectory}fastmemo-update.apk`;

/** True in the APK published on GitHub: it updates itself, the Play build updates through the store. */
export function isApkBuild(): boolean {
  return installer != null;
}

export interface ApkDownload {
  /** Resolves once the system installer is open; rejects when the download or the hand-off fails. */
  done: Promise<void>;
  cancel(): void;
}

/** Resolves the next time the app comes back to the foreground. */
function nextForeground(): Promise<void> {
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      subscription.remove();
      resolve();
    });
  });
}

/**
 * Whether FastMemo may install apps. The first time, the system page to allow it opens; the answer is read when the user
 * comes back. Asked before the download: the installer's own prompt ends the install, and the APK would be downloaded again.
 */
export async function ensureInstallAllowed(): Promise<boolean> {
  if (!installer) return false;
  if (await installer.canInstallAsync()) return true;
  const back = nextForeground();
  await installer.openInstallSettingsAsync();
  await back;
  return installer.canInstallAsync();
}

/**
 * Downloads the APK at `url` and opens the system installer on it. `flush` runs right before the hand-off: installing
 * replaces the app and kills its process, so edits typed during the download are saved first.
 */
export function downloadAndInstallApk(
  url: string,
  onProgress: (written: number, total: number) => void,
  flush: () => Promise<void>
): ApkDownload {
  let cancelled = false;
  const download = FileSystem.createDownloadResumable(url, APK_PATH, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    if (totalBytesExpectedToWrite > 0) onProgress(totalBytesWritten, totalBytesExpectedToWrite);
  });

  const done = (async () => {
    if (!installer) throw new Error("No installer in this build");
    await FileSystem.deleteAsync(APK_PATH, { idempotent: true });
    if (cancelled) throw new Error("cancelled");
    const result = await download.downloadAsync();
    // a cancelled download resolves with no result
    if (cancelled || !result) throw new Error("cancelled");
    if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
    await flush();
    await installer.installAsync(await FileSystem.getContentUriAsync(APK_PATH));
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      download.cancelAsync().catch(() => {});
    },
  };
}

/** Deletes the APK an earlier update left in the cache (it stays there once installed). */
export function clearDownloadedApk(): void {
  if (installer) FileSystem.deleteAsync(APK_PATH, { idempotent: true }).catch(() => {});
}
