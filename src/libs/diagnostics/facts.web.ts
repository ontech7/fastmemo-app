import { getDeviceInfo } from "@/libs/device";
import { isTauri } from "@/utils/platform";
import { getCurrentAppVersion } from "@/utils/version";

/** What kind of app is running, for Sentry's `platform_kind` tag. */
export type PlatformKind = "android" | "ios" | "web" | "desktop-macos" | "desktop-windows" | "desktop-linux";

const userAgent = (): string => (typeof navigator !== "undefined" ? navigator.userAgent : "");

/** The system's name from the user agent. Its version is left out: a webview's user agent is frozen and would lie. */
const systemName = (): "macOS" | "Windows" | "Linux" | null => {
  const ua = userAgent();
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Macintosh") || ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Linux") || ua.includes("X11")) return "Linux";
  return null;
};

export function getPlatformKind(): PlatformKind {
  if (!isTauri()) return "web";
  const system = systemName();
  if (system === "Windows") return "desktop-windows";
  if (system === "Linux") return "desktop-linux";
  return "desktop-macos";
}

export function getOs(): { os: string; osVersion?: string } {
  return { os: systemName() ?? "Web" };
}

export function getDeviceBasics(): { brand: string; modelName: string; deviceType: string } {
  return { brand: "web", modelName: getDeviceInfo().modelName, deviceType: "DESKTOP" };
}

/** Desktop and web have no updates over the air: the version alone. */
export function appVersionWithUpdate(): string {
  return getCurrentAppVersion();
}
