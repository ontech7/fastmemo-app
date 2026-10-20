import { Directory, File, Paths } from "expo-file-system";

import type { NoteStoreBackend } from "./noteStore";

/*
 * The note store on a device: one file per value, `<name>.json` in the `fastmemo-notes` folder, read and written
 * synchronously (each is small). Names are escaped to letters, digits and `-_.!~*'()`: a path is a URI here, and a
 * `%XX` in it is decoded (a `/` in a note id would make a folder). A write goes to `<name>.json.tmp` and is then moved over the file; Android's move
 * deletes the old file before renaming, so a crash in between leaves only the spare, which `read` falls back to.
 */

const FOLDER = "fastmemo-notes";
const SUFFIX = ".json";
const SPARE = `${SUFFIX}.tmp`;
const ASIDE = `${SUFFIX}.corrupt-`;

/**
 * Where redux-persist stored the notes before (fsStorage.ts). The file is named `persist:root_notes`: fsStorage put
 * `persist%3Aroot_notes` in the URI, and the URI was decoded. A segment given to `File` is encoded (`%` -> `%25`), so
 * here it's the name as it is on disk.
 */
const LEGACY_FOLDER = "reduxPersist";
const LEGACY_NAME = "persist:root_notes";

/** `encodeURIComponent` with `_` for `%` (and `_` itself escaped first): reversible, and nothing a URI decodes. */
const escape = (name: string) => encodeURIComponent(name).replace(/_/g, "%5F").replace(/%/g, "_");
const unescape = (escaped: string) => decodeURIComponent(escaped.replace(/_/g, "%"));

const folder = () => new Directory(Paths.document, FOLDER);
const fileOf = (name: string) => new File(folder(), `${escape(name)}${SUFFIX}`);
const spareOf = (name: string) => new File(folder(), `${escape(name)}${SPARE}`);

const readText = (file: File) => (file.exists ? file.textSync() : undefined);

const isCompleteJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};

/** The stored name a file is for, or `null` if it isn't a value or a spare. */
const nameOf = (fileName: string) => {
  const encoded = fileName.endsWith(SUFFIX)
    ? fileName.slice(0, -SUFFIX.length)
    : fileName.endsWith(SPARE)
      ? fileName.slice(0, -SPARE.length)
      : null;
  if (encoded === null) return null;
  try {
    return unescape(encoded);
  } catch {
    return null; // not one of ours
  }
};

export const createNoteStoreBackend = (): NoteStoreBackend => {
  let folderReady = false;
  const ensureFolder = () => {
    if (folderReady) return;
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    folderReady = true;
  };

  return {
    read: (name) => readText(fileOf(name)) ?? readText(spareOf(name)),

    spare: (name) => readText(spareOf(name)),

    write: (name, value) => {
      ensureFolder();
      try {
        const spare = spareOf(name);
        spare.writeSync(value);
        spare.moveSync(fileOf(name), { overwrite: true });
      } catch (error) {
        folderReady = false; // look at the folder again next time
        throw error;
      }
    },

    remove: (name) => {
      for (const file of [fileOf(name), spareOf(name)]) if (file.exists) file.delete();
    },

    setAside: (name) => {
      const file = fileOf(name);
      if (file.exists) file.moveSync(new File(folder(), `${escape(name)}${ASIDE}${Date.now()}`));
    },

    list: () => {
      const dir = folder();
      if (!dir.exists) return [];
      const names = dir
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((file) => nameOf(file.name))
        .filter((name): name is string => name !== null);
      return [...new Set(names)];
    },

    readLegacy: () => {
      // As fsStorage reads it: a write cut short left the complete content in its spare.
      const main = readText(new File(Paths.document, LEGACY_FOLDER, LEGACY_NAME));
      if (main !== undefined && isCompleteJson(main)) return main;
      const spare = readText(new File(Paths.document, LEGACY_FOLDER, `${LEGACY_NAME}.tmp`));
      return spare !== undefined && isCompleteJson(spare) ? spare : main;
    },

    legacyStamp: () => {
      const info = new File(Paths.document, LEGACY_FOLDER, LEGACY_NAME).info();
      return info.exists ? `${info.size}:${info.modificationTime}` : null;
    },
  };
};
