import localforage from "localforage";

import type { HistoryBackend } from "./store";

/*
 * The versions on the web and the desktop: a database of their own (`fastmemo-history`), so opening it can never upgrade
 * or block the one that holds the notes. IndexedDB only: without it the history is simply not kept.
 */

let instance: LocalForage | null = null;
const store = () =>
  (instance ??= localforage.createInstance({
    name: "fastmemo-history",
    storeName: "versions",
    driver: localforage.INDEXEDDB,
  }));

export function createHistoryBackend(): HistoryBackend {
  return {
    list: () => store().keys(),
    read: async (name) => {
      const value = await store().getItem<string>(name);
      return value === null || value === undefined ? null : String(value);
    },
    write: async (name, value) => {
      await store().setItem(name, value);
    },
    remove: (name) => store().removeItem(name),
    clear: () => store().clear(),
  };
}
