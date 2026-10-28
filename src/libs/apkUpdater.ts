import * as FileSystem from "expo-file-system/legacy";
import { AppState, NativeModules } from "react-native";

// The GitHub APK's updater (ADR-031). Its native half (modules-apk/fastmemo-installer) is linked only into that build: the
// Play build, and the web (`apkUpdater.web.ts`), have none.

interface FastmemoInstallerApi {
  canInstallAsync(): Promise<boolean>;
  openInstallSettingsAsync(): Promise<void>;
  /** Rejects with code E_NOT_VERIFIED when the APK isn't this app signed with this app's key. */
  installAsync(fileUri: string, contentUri: string): Promise<void>;
}

const installer: FastmemoInstallerApi | undefined = NativeModules.FastmemoInstaller;

const APK_PATH = `${FileSystem.cacheDirectory}fastmemo-update.apk`;

/** The only place an update is downloaded from: the app's GitHub releases (the API only relays the asset's URL). */
const APK_URL_PREFIX = "https://github.com/ontech7/fastmemo-app/releases/download/";

/** Past this, the wait for the user to come back from the system settings ends (e.g. split screen: the app never left). */
const INSTALL_SETTINGS_TIMEOUT_MS = 2 * 60 * 1000;

/** True in the APK published on GitHub: it updates itself, the Play build updates through the store. */
export function isApkBuild(): boolean {
  return installer != null;
}

/** Whether `url` is an APK attached to one of the app's GitHub releases. */
export function isTrustedApkUrl(url: string): boolean {
  return url.startsWith(APK_URL_PREFIX) && !url.includes("..") && url.toLowerCase().endsWith(".apk");
}

export interface ApkDownload {
  /** Resolves once the system installer is open; rejects when the download or the hand-off fails. */
  done: Promise<void>;
  cancel(): void;
}

/** Resolves the next time the app comes back to the foreground, or after INSTALL_SETTINGS_TIMEOUT_MS. */
function nextForeground(): { back: Promise<void>; stop: () => void } {
  let stop = () => {};
  const back = new Promise<void>((resolve) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") stop();
    });
    const timer = setTimeout(() => stop(), INSTALL_SETTINGS_TIMEOUT_MS);
    stop = () => {
      subscription.remove();
      clearTimeout(timer);
      resolve();
    };
  });
  return { back, stop };
}

/**
 * Whether FastMemo may install apps. The first time, the system page to allow it opens; the answer is read when the user
 * comes back. Asked before the download: the installer's own prompt ends the install, and the APK would be downloaded again.
 */
export async function ensureInstallAllowed(): Promise<boolean> {
  if (!installer) return false;
  if (await installer.canInstallAsync()) return true;
  const { back, stop } = nextForeground();
  try {
    await installer.openInstallSettingsAsync();
  } catch (error) {
    stop();
    throw error;
  }
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
    if (!isTrustedApkUrl(url)) throw new Error(`Not a FastMemo release asset: ${url}`);
    await FileSystem.deleteAsync(APK_PATH, { idempotent: true });
    if (cancelled) throw new Error("cancelled");
    const result = await download.downloadAsync();
    // a cancelled download resolves with no result
    if (cancelled || !result) throw new Error("cancelled");
    if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
    await flush();
    await installer.installAsync(APK_PATH, await FileSystem.getContentUriAsync(APK_PATH));
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
