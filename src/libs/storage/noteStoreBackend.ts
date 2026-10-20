import { hashText } from "@/utils/hash";
import * as FileSystem from "expo-file-system/legacy";

import type { NoteStoreBackend } from "./noteStore";

/*
 * The note store on a device: one file per value, `<name>.json` in the `fastmemo-notes` folder. The file calls are
 * asynchronous (they run off the JS thread: a bulk write of every note doesn't freeze the app). A write goes to
 * `<name>.json.tmp`, then is renamed over the file (an atomic replace on Android). The folder is listed once and kept
 * up to date here (this is its only writer), so a read needs no existence check.
 *
 * File names: a path is a URI here, and a `%XX` in it is decoded (a `/` in a note id would make a folder), so names are
 * escaped to letters, digits and `-_.!~*'()`. A name that can't be one (a lone surrogate, or too long) is stored under
 * `@<hash>.json`, with the name on the first line.
 */

const FOLDER = `${FileSystem.documentDirectory}fastmemo-notes`;
const SUFFIX = ".json";
const SPARE = `${SUFFIX}.tmp`;
const ASIDE = `${SUFFIX}.corrupt-`;
/** Starts a file name made from a hash (escaping never makes an `@`). */
const HASHED = "@";
/** The longest escaped name used as is: with the suffixes, well under the 255 bytes a file name can take. */
const MAX_ESCAPED = 160;

/** Where redux-persist stored the notes before (fsStorage.ts names files by the URI-encoded key). */
const LEGACY_FOLDER = `${FileSystem.documentDirectory}reduxPersist`;
const legacyFile = (key: string) => `${LEGACY_FOLDER}/${encodeURIComponent(key)}`;
const LEGACY = legacyFile("persist:root_notes");
/** The copy of the notes legacyRootNotes.ts saved before folding them out of the root value. */
const ROOT_BACKUP = legacyFile("backup:root-notes");
/** What fsStorage set aside of those two (`<key>.corrupt-<time>`). */
const LEGACY_ASIDE = /^(persist:root_notes|backup:root-notes)\.corrupt/;

const uriOf = (file: string) => `${FOLDER}/${file}`;

/** `encodeURIComponent` with `_` for `%` (and `_` itself escaped first): reversible, and nothing a URI decodes. */
const escape = (name: string): string | null => {
  try {
    const escaped = encodeURIComponent(name).replace(/_/g, "%5F").replace(/%/g, "_");
    return escaped.length <= MAX_ESCAPED ? escaped : null;
  } catch {
    return null; // a lone surrogate
  }
};
const unescape = (escaped: string) => {
  try {
    return decodeURIComponent(escaped.replace(/_/g, "%"));
  } catch {
    return null; // not one of ours
  }
};

/** The file name a value is stored under, without its suffix. */
const baseOf = (name: string) => escape(name) ?? `${HASHED}${hashText(name)}`;

/** The value a hashed file holds for `name` (after its first line, which must be that name). */
const unwrap = (name: string, text: string) => {
  const end = text.indexOf("\n");
  return end !== -1 && text.slice(0, end) === JSON.stringify(name) ? text.slice(end + 1) : undefined;
};

const isCompleteJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};

const readIfExists = async (uri: string) =>
  (await FileSystem.getInfoAsync(uri)).exists ? await FileSystem.readAsStringAsync(uri) : undefined;

export const createNoteStoreBackend = (): NoteStoreBackend => {
  let listing: Promise<Set<string>> | undefined;
  /** The files in the folder (created if missing), listed once. */
  const files = () =>
    (listing ??= (async () => {
      if (!(await FileSystem.getInfoAsync(FOLDER)).exists) {
        await FileSystem.makeDirectoryAsync(FOLDER, { intermediates: true });
        return new Set<string>();
      }
      return new Set(await FileSystem.readDirectoryAsync(FOLDER));
    })().catch((error: unknown) => {
      listing = undefined; // look at the folder again next time
      throw error;
    }));

  const readFile = async (name: string, file: string) => {
    const text = await FileSystem.readAsStringAsync(uriOf(file));
    return file.startsWith(HASHED) ? unwrap(name, text) : text;
  };

  /** The name a hashed file holds (its first line), or `null`. */
  const nameInFile = async (file: string) => {
    const text = await FileSystem.readAsStringAsync(uriOf(file));
    try {
      const name: unknown = JSON.parse(text.slice(0, Math.max(0, text.indexOf("\n"))));
      return typeof name === "string" ? name : null;
    } catch {
      return null;
    }
  };

  return {
    read: async (name) => {
      const file = baseOf(name) + SUFFIX;
      return (await files()).has(file) ? readFile(name, file) : undefined;
    },

    spare: async (name) => {
      const file = baseOf(name) + SPARE;
      return (await files()).has(file) ? readFile(name, file) : undefined;
    },

    write: async (name, value) => {
      const present = await files();
      const base = baseOf(name);
      try {
        await FileSystem.writeAsStringAsync(
          uriOf(base + SPARE),
          base.startsWith(HASHED) ? `${JSON.stringify(name)}\n${value}` : value
        );
        present.add(base + SPARE);
        await FileSystem.moveAsync({ from: uriOf(base + SPARE), to: uriOf(base + SUFFIX) });
        present.delete(base + SPARE);
        present.add(base + SUFFIX);
      } catch (error) {
        listing = undefined; // the folder may have gone: look again next time
        throw error;
      }
    },

    remove: async (name) => {
      const present = await files();
      const base = baseOf(name);
      for (const file of [base + SUFFIX, base + SPARE]) {
        if (!present.has(file)) continue;
        await FileSystem.deleteAsync(uriOf(file), { idempotent: true });
        present.delete(file);
      }
    },

    setAside: async (name) => {
      const present = await files();
      const file = baseOf(name) + SUFFIX;
      if (!present.has(file)) return;
      const aside = `${baseOf(name)}${ASIDE}${Date.now()}`;
      await FileSystem.moveAsync({ from: uriOf(file), to: uriOf(aside) });
      present.delete(file);
      present.add(aside);
    },

    list: async () => {
      const names = new Set<string>();
      for (const file of await files()) {
        const base = file.endsWith(SUFFIX)
          ? file.slice(0, -SUFFIX.length)
          : file.endsWith(SPARE)
            ? file.slice(0, -SPARE.length)
            : null;
        const name = base === null ? null : base.startsWith(HASHED) ? await nameInFile(file) : unescape(base);
        if (name !== null) names.add(name);
      }
      return [...names];
    },

    readLegacy: async () => {
      // As fsStorage reads it: a write cut short left the complete content in its spare.
      const main = await readIfExists(LEGACY);
      if (main !== undefined && isCompleteJson(main)) return main;
      const spare = await readIfExists(`${LEGACY}.tmp`);
      return spare !== undefined && isCompleteJson(spare) ? spare : main;
    },

    legacyStamp: async () => {
      const info = await FileSystem.getInfoAsync(LEGACY);
      return info.exists ? `${info.size}:${info.modificationTime}` : null;
    },

    removeCopies: async () => {
      for (const uri of [LEGACY, `${LEGACY}.tmp`, ROOT_BACKUP, `${ROOT_BACKUP}.tmp`]) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      const present = await files();
      for (const file of [...present]) {
        if (!file.includes(ASIDE)) continue;
        await FileSystem.deleteAsync(uriOf(file), { idempotent: true });
        present.delete(file);
      }
      if ((await FileSystem.getInfoAsync(LEGACY_FOLDER)).exists) {
        for (const file of await FileSystem.readDirectoryAsync(LEGACY_FOLDER)) {
          if (LEGACY_ASIDE.test(file)) await FileSystem.deleteAsync(legacyFile(file), { idempotent: true });
        }
      }
    },
  };
};
