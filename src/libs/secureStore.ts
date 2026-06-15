import * as SecureStore from "expo-secure-store";

/**
 * Per-device secure storage for small secrets (the vault DEK).
 *
 * Native: backed by the OS keystore (iOS Keychain / Android Keystore) via
 * expo-secure-store, so the cached DEK is protected at rest by the platform.
 * The web/Tauri variant lives in secureStore.web.ts.
 */

export const secureStoreSet = async (key: string, value: string): Promise<void> => {
  await SecureStore.setItemAsync(key, value);
};

export const secureStoreGet = async (key: string): Promise<string | null> => {
  return SecureStore.getItemAsync(key);
};

export const secureStoreRemove = async (key: string): Promise<void> => {
  await SecureStore.deleteItemAsync(key);
};
