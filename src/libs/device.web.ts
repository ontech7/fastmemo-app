import { isTauri } from "@/utils/platform";

export interface DeviceInfo {
  modelName: string;
  brand: string;
}

export const getDeviceInfo = (): DeviceInfo => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  if (isTauri()) {
    let modelName = "Desktop";

    if (ua.includes("Macintosh") || ua.includes("Mac OS X")) {
      modelName = "MacOS";
    } else if (ua.includes("Windows")) {
      modelName = "Windows";
    }
    if (ua.includes("Linux")) {
      modelName = "Linux";
    }

    return {
      modelName: `${modelName} (Desktop)`,
      brand: "web",
    };
  }

  let browserName = "Unknown Browser";
  if (ua.includes("Chrome")) browserName = "Chrome";
  else if (ua.includes("Firefox")) browserName = "Firefox";
  else if (ua.includes("Safari")) browserName = "Safari";
  else if (ua.includes("Edge")) browserName = "Edge";

  return {
    modelName: `${browserName} (Browser)`,
    brand: "web",
  };
};
