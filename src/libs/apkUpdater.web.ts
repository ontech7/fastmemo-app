// Web/Tauri build: the self-updating APK is Android only (`apkUpdater.ts`).

export interface ApkDownload {
  done: Promise<void>;
  cancel(): void;
}

export function isApkBuild(): boolean {
  return false;
}

export function isTrustedApkUrl(_url: string): boolean {
  return false;
}

export async function ensureInstallAllowed(): Promise<boolean> {
  return false;
}

export function downloadAndInstallApk(
  _url: string,
  _onProgress: (written: number, total: number) => void,
  _flush: () => Promise<void>
): ApkDownload {
  return { done: Promise.reject(new Error("No APK updates on the web")), cancel: () => {} };
}

export function clearDownloadedApk(): void {}
