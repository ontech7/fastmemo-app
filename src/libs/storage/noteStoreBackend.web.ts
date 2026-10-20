import FSStorage from "@/libs/storage/fsStorage";

import type { NoteStoreBackend } from "./noteStore";

/*
 * The note store on the web and the desktop: one IndexedDB value per name (`v2:<name>`), next to the single value
 * redux-persist used before (`persist:root_notes`) in the same database. An IndexedDB write is atomic: no spares.
 */

const PREFIX = "v2:";
const LEGACY_KEY = "persist:root_notes";
const ASIDE = "corrupt:";

const storage = () => {
  // On the web it's the localforage instance (fsStorage.web.ts); the types only know the native one.
  const store = FSStorage() as unknown as LocalForage | null;
  if (!store) throw new Error("noteStore: IndexedDB isn't available");
  return store;
};

const asText = (value: unknown) => (value === null || value === undefined ? undefined : String(value));

export const createNoteStoreBackend = (): NoteStoreBackend => ({
  read: async (name) => asText(await storage().getItem(PREFIX + name)),

  spare: () => undefined,

  write: async (name, value) => {
    await storage().setItem(PREFIX + name, value);
  },

  remove: async (name) => {
    await storage().removeItem(PREFIX + name);
  },

  setAside: async (name) => {
    const store = storage();
    const value = await store.getItem(PREFIX + name);
    await store.setItem(`${ASIDE}${Date.now()}:${name}`, value);
    await store.removeItem(PREFIX + name);
  },

  list: async () => (await storage().keys()).filter((key) => key.startsWith(PREFIX)).map((key) => key.slice(PREFIX.length)),

  readLegacy: async () => asText(await storage().getItem(LEGACY_KEY)),

  // IndexedDB can't tell when a value changed without reading it: the legacy notes are read only to migrate.
  legacyStamp: () => null,
});
