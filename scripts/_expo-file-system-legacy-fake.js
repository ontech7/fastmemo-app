// An in-memory stand-in for `expo-file-system/legacy`, with Android's behaviour where it matters: a URI's path is
// `Uri.parse(uri).path` (a `?` or `#` ends it, `%XX` is decoded once), a move is a rename that replaces the target in
// one step, a write creates the file, and every call is asynchronous (it settles on a later turn, so calls made
// together interleave). The disk is `globalThis.__fakeDisk` (see note-store.test.mjs), so a test can swap it, copy it
// at any step (to boot from it, as after a crash) or make an operation fail.

const disk = () => globalThis.__fakeDisk;
const turn = () => new Promise((resolve) => setImmediate(resolve));

export const documentDirectory = "file:///data/files/";

const pathOf = (uri) => {
  const rest = uri.replace(/^file:\/*/, "/").split(/[?#]/)[0];
  return rest
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/")
    .replace(/\/+$/, "");
};
const parentOf = (path) => path.slice(0, path.lastIndexOf("/"));

export const getInfoAsync = async (uri) => {
  await turn();
  const path = pathOf(uri);
  const file = disk().files.get(path);
  if (file) return { exists: true, isDirectory: false, size: file.text.length, modificationTime: file.mtime / 1000, uri };
  if (disk().dirs.has(path)) return { exists: true, isDirectory: true, size: 0, modificationTime: 0, uri };
  return { exists: false, isDirectory: false, uri };
};

export const readAsStringAsync = async (uri) => {
  await turn();
  const path = pathOf(uri);
  disk().step("read", path);
  const file = disk().files.get(path);
  if (!file) throw new Error(`ENOENT: ${path}`);
  return file.text;
};

export const writeAsStringAsync = async (uri, text) => {
  await turn();
  const path = pathOf(uri);
  if (!disk().dirs.has(parentOf(path))) throw new Error(`ENOENT (no folder): ${path}`);
  disk().write(path, String(text));
};

export const moveAsync = async ({ from, to }) => {
  await turn();
  disk().rename(pathOf(from), pathOf(to));
};

export const deleteAsync = async (uri, options = {}) => {
  await turn();
  const path = pathOf(uri);
  if (!disk().files.has(path)) {
    if (options.idempotent) return;
    throw new Error(`ENOENT: ${path}`);
  }
  disk().remove(path);
};

export const makeDirectoryAsync = async (uri) => {
  await turn();
  disk().dirs.add(pathOf(uri));
};

export const readDirectoryAsync = async (uri) => {
  await turn();
  const path = pathOf(uri);
  if (!disk().dirs.has(path)) throw new Error(`not a folder: ${path}`);
  return [...disk().files.keys()].filter((file) => parentOf(file) === path).map((file) => file.slice(path.length + 1));
};
