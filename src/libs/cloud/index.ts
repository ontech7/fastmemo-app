import { getDeviceInfo } from "@/libs/device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-uuid";

import { FirebaseBackend } from "./firebaseBackend";
import { CloudRouter } from "./router";
import { ServerBackend } from "./serverBackend";
import type { CloudBackend, DeviceInfo } from "./types";

export type {
  ChangeSet,
  CloudBackend,
  CloudDevice,
  DeviceInfo,
  DevicesSnapshot,
  NoteRef,
  Presence,
  PushOps,
  PushResult,
  VaultRead,
} from "./types";
export { PRESENCE_TTL_MS } from "./types";
export {
  cloudScope,
  isCloudSettingsComplete,
  isLoopbackUrl,
  isPlainHttp,
  isTailscaleUrl,
  normalizeServerUrl,
  providerOf,
} from "./scope";

/** The cloud this device syncs with (ADR-016): Firebase or a FastMemo server, as the settings say (ADR-017). */
export const cloud: CloudBackend = new CloudRouter({ firebase: new FirebaseBackend(), server: new ServerBackend() });

/** Whether a cloud connection is set up (not whether it's reachable). */
export const isCloudConnected = (): boolean => cloud.isActive();

/** Runs `callback` only while a cloud connection is set up (e.g. to fill the outbox). */
export const only_if_cloudConnected = (callback: () => void): void => {
  if (isCloudConnected()) callback();
};

let deviceUuid: string | null = null;

/** This device's id in the cloud, created on first use. Null if storage failed. */
export const getDeviceUuid = async (): Promise<string | null> => {
  if (deviceUuid) return deviceUuid;
  try {
    const stored = await AsyncStorage.getItem("@deviceUuid");
    if (stored !== null) {
      deviceUuid = stored;
    } else {
      const created = uuid();
      await AsyncStorage.setItem("@deviceUuid", created);
      deviceUuid = created;
    }
    return deviceUuid;
  } catch {
    return null;
  }
};

/** This device, as registered in the cloud. */
export const getThisDevice = async (): Promise<DeviceInfo | null> => {
  const id = await getDeviceUuid();
  if (!id) return null;
  const { modelName, brand } = getDeviceInfo();
  return { uuid: id, modelName, brand };
};
