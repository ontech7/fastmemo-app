let notesStorage = null;

const getNotesStorage = () => {
  if (!notesStorage && typeof window !== "undefined") {
    const localforage = require("localforage");
    notesStorage = localforage.createInstance({
      name: "fastmemo",
      storeName: "notes",
      driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
    });
  }
  return notesStorage;
};

const webFSStorage = {
  getItem: async (key) => {
    try {
      const storage = getNotesStorage();
      if (!storage) return null;
      const value = await storage.getItem(key);
      return value;
    } catch (error) {
      console.error("[WebFSStorage] getItem error:", error);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      const storage = getNotesStorage();
      if (!storage) return;
      await storage.setItem(key, value);
    } catch (error) {
      console.error("[WebFSStorage] setItem error:", error);
    }
  },

  removeItem: async (key) => {
    try {
      const storage = getNotesStorage();
      if (!storage) return;
      await storage.removeItem(key);
    } catch (error) {
      console.error("[WebFSStorage] removeItem error:", error);
    }
  },
};

export default webFSStorage;
