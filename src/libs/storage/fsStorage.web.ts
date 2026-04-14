import localforage from "localforage";

let notesStorage: LocalForage | null = null;

const FSStorage = (): LocalForage | null => {
  if (!notesStorage && typeof window !== "undefined") {
    notesStorage = localforage.createInstance({
      name: "fastmemo",
      storeName: "notes",
      driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
    });
  }
  return notesStorage;
};

export default FSStorage;
