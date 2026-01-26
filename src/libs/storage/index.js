import { Platform } from "react-native";

export const getNotesStorage = () => {
  if (Platform.OS === "web") {
    return require("./fsStorage.web").default;
  }
  return require("./fsStorage.native").default;
};

let _asyncStorage = null;

const getAsyncStorage = () => {
  if (!_asyncStorage) {
    _asyncStorage = require("@react-native-async-storage/async-storage").default;
  }
  return _asyncStorage;
};

export const AsyncStorage = {
  getItem: (...args) => getAsyncStorage().getItem(...args),
  setItem: (...args) => getAsyncStorage().setItem(...args),
  removeItem: (...args) => getAsyncStorage().removeItem(...args),
  mergeItem: (...args) => getAsyncStorage().mergeItem(...args),
  clear: (...args) => getAsyncStorage().clear(...args),
  getAllKeys: (...args) => getAsyncStorage().getAllKeys(...args),
  multiGet: (...args) => getAsyncStorage().multiGet(...args),
  multiSet: (...args) => getAsyncStorage().multiSet(...args),
  multiRemove: (...args) => getAsyncStorage().multiRemove(...args),
  multiMerge: (...args) => getAsyncStorage().multiMerge(...args),
};
