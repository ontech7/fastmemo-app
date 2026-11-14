import { baseOf, HASHED, unescape, unwrap } from "@/libs/storage/noteStoreBackend";
import * as FileSystem from "expo-file-system/legacy";

import type { HistoryBackend } from "./store";

/*
 * The versions on a device: one file per value, `<name>.json` in `fastmemo-history`, next to the notes' own folder and
 * named the way the notes' files are. A write goes to `<name>.json.tmp`, then is renamed over the file.
 */

const FOLDER = `${FileSystem.documentDirectory}fastmemo-history`;
const SUFFIX = ".json";
const SPARE = `${SUFFIX}.tmp`;

const uriOf = (file: string) => `${FOLDER}/${file}`;

const ensureFolder = async () => {
  if (!(await FileSystem.getInfoAsync(FOLDER)).exists) await FileSystem.makeDirectoryAsync(FOLDER, { intermediates: true });
};

export function createHistoryBackend(): HistoryBackend {
  return {
    list: async () => {
      if (!(await FileSystem.getInfoAsync(FOLDER)).exists) return [];
      const names: string[] = [];
      for (const file of await FileSystem.readDirectoryAsync(FOLDER)) {
        if (!file.endsWith(SUFFIX)) continue;
        const base = file.slice(0, -SUFFIX.length);
        if (base.startsWith(HASHED)) {
          const text = await FileSystem.readAsStringAsync(uriOf(file));
          try {
            const name: unknown = JSON.parse(text.slice(0, Math.max(0, text.indexOf("\n"))));
            if (typeof name === "string") names.push(name);
          } catch {
            // not one of ours
          }
        } else {
          const name = unescape(base);
          if (name !== null) names.push(name);
        }
      }
      return names;
    },

    read: async (name) => {
      const base = baseOf(name);
      const uri = uriOf(base + SUFFIX);
      if (!(await FileSystem.getInfoAsync(uri)).exists) return null;
      const text = await FileSystem.readAsStringAsync(uri);
      return base.startsWith(HASHED) ? (unwrap(name, text) ?? null) : text;
    },

    write: async (name, value) => {
      await ensureFolder();
      const base = baseOf(name);
      await FileSystem.writeAsStringAsync(
        uriOf(base + SPARE),
        base.startsWith(HASHED) ? `${JSON.stringify(name)}\n${value}` : value
      );
      await FileSystem.moveAsync({ from: uriOf(base + SPARE), to: uriOf(base + SUFFIX) });
    },

    remove: async (name) => {
      const base = baseOf(name);
      await FileSystem.deleteAsync(uriOf(base + SUFFIX), { idempotent: true });
      await FileSystem.deleteAsync(uriOf(base + SPARE), { idempotent: true });
    },

    clear: async () => {
      await FileSystem.deleteAsync(FOLDER, { idempotent: true });
    },
  };
}
