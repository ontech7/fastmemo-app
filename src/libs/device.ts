import * as Device from "expo-device";

export interface DeviceInfo {
  modelName: string;
  brand: string;
}

export const getDeviceInfo = (): DeviceInfo => {
  return {
    modelName: Device.modelName || "Unknown",
    brand: Device.brand || "Unknown",
  };
};
