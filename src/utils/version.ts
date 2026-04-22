import { configs } from "@/configs";
import { isTauri } from "@/utils/platform";
import { Platform } from "react-native";

/**
 * Returns true if the app is running inside a Tauri desktop shell
 * or on plain web (both map to the `desktop` version in the API payload).
 */
export function isDesktopOrWeb(): boolean {
  return Platform.OS === "web" || isTauri();
}

/**
 * Returns the current app version for the running platform.
 * Mobile (android/ios) -> `configs.app.version.mobile`
 * Desktop/Web          -> `configs.app.version.web`
 */
export function getCurrentAppVersion(): string {
  return isDesktopOrWeb() ? configs.app.version.web : configs.app.version.mobile;
}

/**
 * Compares two semver-like version strings (e.g. "2.9.0", "0.3.1").
 * Only the numeric dot-separated parts are considered; suffixes (e.g. "-beta")
 * are stripped before comparison.
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) =>
    v
      .split("-")[0]
      .split(".")
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isNaN(n) ? 0 : n;
      });

  const aParts = parse(a);
  const bParts = parse(b);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i++) {
    const ai = aParts[i] ?? 0;
    const bi = bParts[i] ?? 0;
    if (ai < bi) return -1;
    if (ai > bi) return 1;
  }

  return 0;
}

/**
 * Returns true if `latest` is strictly greater than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(current, latest) === -1;
}

/**
 * Returns the best URL to send the user to in order to update the app
 * for the current platform.
 *
 * - Android  -> Play Store listing
 * - iOS      -> App Store listing
 * - Tauri/Web -> `releaseUrl` from the API response (GitHub release)
 */
export function pickUpdateUrl(releaseUrl: string): string {
  if (Platform.OS === "android") return configs.app.playStoreUrl;
  if (Platform.OS === "ios") return configs.app.appStoreUrl;
  return releaseUrl;
}
