// Web/Tauri build. Mobile uses the `biometric.native.ts` sibling, so
// `expo-local-authentication` is never pulled into the React Native bundle (and
// `@tauri-apps/api` never reaches mobile). In a plain browser biometrics are
// unavailable; only inside a Tauri WebView on macOS/Windows do they work.

import { isTauri } from "@/utils/platform";

/**
 * Desktop biometric support is scoped to macOS (Touch ID) and Windows (Hello).
 * Linux is intentionally excluded — its fingerprint stack is unreliable, so
 * those users stay on the secret code. Detection mirrors `device.web.ts`.
 */
const isSupportedDesktopOS = (): boolean => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /Macintosh|Mac OS X|Windows/.test(ua);
};

/** Whether the fingerprint section should be offered / used on this platform. */
export const isBiometricSupported = (): boolean => isTauri() && isSupportedDesktopOS();

/**
 * Trigger the OS biometric prompt via the Rust `biometric_authenticate` command.
 * Resolves to `true` on success, `false` on cancel/failure/unavailable — callers
 * fall back to the secret code. `reason` is the localized prompt message.
 */
export const authenticateBiometric = async (reason: string): Promise<boolean> => {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    return await invoke<boolean>("biometric_authenticate", { reason });
  } catch {
    return false;
  }
};
