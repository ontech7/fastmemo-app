import * as FileSystem from "expo-file-system/legacy";

// Vendored from the (unmaintained) `redux-persist-expo-fs-storage` package so we can
// depend on `expo-file-system/legacy` instead of the removed top-level legacy API
// (Expo SDK 54+). Paths are kept identical to the original library so persisted
// Redux state created by previous versions is still found after upgrading.

const DocumentDir = FileSystem.documentDirectory;

// redux-persist can't parse a truncated file: it then rehydrates the empty initial state, and its
// next write replaces every stored note with it. So each write goes to `<file>.tmp` first and is then
// moved over the real file (an atomic rename on Android), and reads fall back to a complete `.tmp`.
const TMP_SUFFIX = ".tmp";
// An unreadable file with nothing to fall back to is set aside under this suffix, for recovery.
const CORRUPT_SUFFIX = ".corrupt";

const isCompleteJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const readIfExists = async (path: string) => {
  const { exists } = await FileSystem.getInfoAsync(path);
  return exists ? await FileSystem.readAsStringAsync(path) : undefined;
};

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

  const writeItem = async (key: string, value: string) => {
    const { exists } = await FileSystem.getInfoAsync(baseFolder);
    if (exists === false) {
      await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
    }
    const pathKey = pathForKey(key);
    const tmpPath = `${pathKey}${TMP_SUFFIX}`;
    await FileSystem.writeAsStringAsync(tmpPath, value);
    try {
      await FileSystem.moveAsync({ from: tmpPath, to: pathKey });
    } catch {
      await FileSystem.writeAsStringAsync(pathKey, value);
      await FileSystem.deleteAsync(tmpPath, { idempotent: true });
    }
  };

  const removeFiles = async (key: string) => {
    const pathKey = pathForKey(key);
    await FileSystem.deleteAsync(pathKey, { idempotent: true });
    await FileSystem.deleteAsync(`${pathKey}${TMP_SUFFIX}`, { idempotent: true });
  };

  // redux-persist doesn't wait for a write to finish before issuing the next one, and overlapping
  // writes would share the `.tmp` file. So operations run one at a time per key, and a write that a
  // newer operation has superseded while it waited is skipped.
  const queues = new Map<string, Promise<void>>();
  const latestOps = new Map<string, number>();
  let opCount = 0;

  // What a key's file was just read to contain: redux-persist writes every key back right after
  // rehydrating, and the first write that would only rewrite those same bytes is skipped.
  const readContents = new Map<string, string>();

  const enqueue = (key: string, op: () => Promise<void>) => {
    const opId = ++opCount;
    latestOps.set(key, opId);
    const run = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(() => (latestOps.get(key) === opId ? op() : undefined));
    queues.set(key, run);
    return run;
  };

  const setItem = (key: string, value: string, callback?: Callback<void>) =>
    withCallback(callback, () =>
      enqueue(key, async () => {
        const readContent = readContents.get(key);
        readContents.delete(key);
        if (readContent !== value) await writeItem(key, value);
      })
    );

  const getItem = (key: string, callback?: Callback<string | undefined>) =>
    withCallback(callback, async () => {
      const pathKey = pathForKey(key);
      const value = await readIfExists(pathKey);
      if (value !== undefined && isCompleteJson(value)) {
        readContents.set(key, value);
        return value;
      }

      // Missing or unreadable: a write interrupted before its move left the complete content here.
      const tmpValue = await readIfExists(`${pathKey}${TMP_SUFFIX}`);
      if (tmpValue !== undefined && isCompleteJson(tmpValue)) {
        return tmpValue;
      }

      if (value !== undefined) {
        console.warn(`FSStorage: "${key}" is unreadable, setting it aside`);
        await FileSystem.moveAsync({ from: pathKey, to: `${pathKey}${CORRUPT_SUFFIX}-${Date.now()}` }).catch(() => {});
      }
      return undefined;
    });

  const removeItem = (key: string, callback?: Callback<void>) =>
    withCallback(callback, () =>
      enqueue(key, () => {
        readContents.delete(key);
        return removeFiles(key);
      })
    );

  const getAllKeys = (callback?: Callback<string[]>) =>
    withCallback(callback, async () => {
      await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
      const files = await FileSystem.readDirectoryAsync(baseFolder);
      return files
        .filter((file) => !file.endsWith(TMP_SUFFIX) && !file.includes(CORRUPT_SUFFIX))
        .map((fileUri) => decodeURIComponent(fileUri));
    });

  return { setItem, getItem, removeItem, getAllKeys };
};

export default FSStorage;
