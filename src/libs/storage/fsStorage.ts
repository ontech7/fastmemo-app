import * as FileSystem from "expo-file-system/legacy";

// Vendored from the (unmaintained) `redux-persist-expo-fs-storage` package so we can
// depend on `expo-file-system/legacy` instead of the removed top-level legacy API
// (Expo SDK 54+). Paths are kept identical to the original library so persisted
// Redux state created by previous versions is still found after upgrading.

const DocumentDir = FileSystem.documentDirectory;

const resolvePath = (...paths: (string | null | undefined)[]) =>
  paths
    .join("/")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");

type Callback<T> = (error: Error | null, result?: T) => void;

async function withCallback<T>(callback: Callback<T> | undefined, func: () => Promise<T>): Promise<T> {
  try {
    const result = await func();
    callback?.(null, result);
    return result;
  } catch (err) {
    if (callback) {
      callback(err as Error);
      return undefined as T;
    }
    throw err;
  }
}

const FSStorage = (location: string | null = DocumentDir, folder = "reduxPersist") => {
  const baseFolder = resolvePath(location, folder);

  const pathForKey = (key: string) => resolvePath(baseFolder, encodeURIComponent(key));

  const setItem = (key: string, value: string, callback?: Callback<void>) =>
    withCallback(callback, async () => {
      const { exists } = await FileSystem.getInfoAsync(baseFolder);
      if (exists === false) {
        await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
      }
      await FileSystem.writeAsStringAsync(pathForKey(key), value);
    });

  const getItem = (key: string, callback?: Callback<string | undefined>) =>
    withCallback(callback, async () => {
      const pathKey = pathForKey(key);
      const { exists } = await FileSystem.getInfoAsync(pathKey);
      if (exists) {
        return await FileSystem.readAsStringAsync(pathKey);
      }
      return undefined;
    });

  const removeItem = (key: string, callback?: Callback<void>) =>
    withCallback(callback, async () => {
      await FileSystem.deleteAsync(pathForKey(key), { idempotent: true });
    });

  const getAllKeys = (callback?: Callback<string[]>) =>
    withCallback(callback, async () => {
      await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
      const files = await FileSystem.readDirectoryAsync(baseFolder);
      return files.map((fileUri) => decodeURIComponent(fileUri));
    });

  return { setItem, getItem, removeItem, getAllKeys };
};

export default FSStorage;
