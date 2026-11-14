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

/** The system and its version as the Rust shell reads them ("macOS 15.6"): null until asked, "" while it answers. */
let systemLabel: string | null = null;

/** Desktop: asks the Rust shell once for the system's version (spec C.7), after the home has drawn (`windowReady`). */
export function readSystemVersion(): void {
  if (systemLabel !== null || !isTauri()) return;
  systemLabel = "";
  import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke<string>("system_version"))
    .then((label) => {
      systemLabel = label;
    })
    .catch(() => {});
}

/**
 * The system's name (from the user agent), and on the desktop its version as the Rust shell read it: "15.6",
 * "11, build 26100", "Ubuntu 24.04.1 LTS"; none when it only knew the bare name.
 */
export function getOs(): { os: string; osVersion?: string } {
  const os = systemName() ?? "Web";
  if (!isTauri() || !systemLabel?.startsWith(os)) return { os };
  const osVersion = systemLabel.slice(os.length).replace(/^[\s,]+/, "");
  return osVersion ? { os, osVersion } : { os };
}

export function getDeviceBasics(): { brand: string; modelName: string; deviceType: string } {
  return { brand: "web", modelName: getDeviceInfo().modelName, deviceType: "DESKTOP" };
}

/** Desktop and web have no updates over the air: the version alone. */
export function appVersionWithUpdate(): string {
  return getCurrentAppVersion();
}
