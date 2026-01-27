import localforage from "localforage";

let notesStorage = null;

const FSStorage = () => {
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
