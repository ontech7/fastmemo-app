import FSStorage from "@/libs/storage/fsStorage";

import type { NoteStoreBackend } from "./noteStore";

/*
 * The note store on the web and the desktop: one IndexedDB value per name (`v2:<name>`), next to the single value
 * redux-persist used before (`persist:root_notes`) in the same database. An IndexedDB write is atomic: no spares.
 * Browser tabs share the database: a Web Lock lets one of them read or write the notes at a time.
 */

const PREFIX = "v2:";
const LEGACY_KEY = "persist:root_notes";
/** The copy of the notes legacyRootNotes.ts saved before folding them out of the root value. */
const ROOT_BACKUP_KEY = "backup:root-notes";
const ASIDE = "corrupt:";
const LOCK = "fastmemo-notes";

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

  removeLegacy: async () => {
    await storage().removeItem(LEGACY_KEY);
  },

  removeCopies: async () => {
    const store = storage();
    for (const key of await store.keys()) {
      if (key === LEGACY_KEY || key === ROOT_BACKUP_KEY || key.startsWith(ASIDE)) await store.removeItem(key);
    }
  },

  // Without Web Locks (an old browser), tabs aren't kept apart: as before the note store.
  exclusive: (task) => (typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(LOCK, task) : task()),
});
