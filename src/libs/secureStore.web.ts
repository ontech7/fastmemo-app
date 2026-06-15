import localforage from "localforage";

/**
 * Per-device secure storage — web/Tauri variant.
 *
 * A browser/WebView has no OS keystore exposed to JS, so we persist in
 * IndexedDB (localforage). This is origin-isolated but not OS-encrypted; on
 * web/Tauri the cached DEK is therefore less protected than on native. The
 * passphrase itself is never stored — only the DEK, and only because the user
 * opted into "unlock once per device". Clearing site data wipes it.
 */

let store: LocalForage | null = null;

const getStore = (): LocalForage | null => {
  if (!store && typeof window !== "undefined") {
    store = localforage.createInstance({
      name: "fastmemo",
      storeName: "vault",
      driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
    });
  }
  return store;
};

export const secureStoreSet = async (key: string, value: string): Promise<void> => {
  await getStore()?.setItem(key, value);
};

export const secureStoreGet = async (key: string): Promise<string | null> => {
  return (await getStore()?.getItem<string>(key)) ?? null;
};

export const secureStoreRemove = async (key: string): Promise<void> => {
  await getStore()?.removeItem(key);
};
