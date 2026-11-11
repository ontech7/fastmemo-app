import * as Device from "expo-device";
import { Platform } from "react-native";

import { getCurrentAppVersion, OTA_REVISION } from "@/utils/version";

/** What kind of app is running, for Sentry's `platform_kind` tag. */
export type PlatformKind = "android" | "ios" | "web" | "desktop-macos" | "desktop-windows" | "desktop-linux";

export function getPlatformKind(): PlatformKind {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** The system and its version, as a report always carries them ("Android", "16"). */
export function getOs(): { os: string; osVersion?: string } {
  const os = Device.osName ?? (Platform.OS === "ios" ? "iOS" : "Android");
  return Device.osVersion ? { os, osVersion: Device.osVersion } : { os };
}

/** Brand, model and kind of device: sent only with the device-information box ticked. Never the device's name. */
export function getDeviceBasics(): { brand: string; modelName: string; deviceType: string } {
  const deviceType = Device.deviceType != null ? Device.DeviceType[Device.deviceType] : null;
  return {
    brand: Device.brand ?? "Unknown",
    modelName: Device.modelName ?? "Unknown",
    deviceType: deviceType ?? "Unknown",
  };
}

/** The app version with its update number, always: "4.1.0 · OTA 0" (the store build itself is update 0). */
export function appVersionWithUpdate(): string {
  return `${getCurrentAppVersion()} · OTA ${OTA_REVISION}`;
}
