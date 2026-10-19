import AsyncStorage from "@react-native-async-storage/async-storage";
import { t } from "i18next";

import type { Note } from "@/types";

import { flushPending } from "@/libs/registry";
import { getDEK } from "@/libs/vaultSession";
import { addLocalCategories, applyCategoriesPlan, categoriesPushed, deleteLocalCategories } from "@/slicers/categoriesSlice";
import { adoptLegacyOutbox, applyNotesPlan, dropNoteUploads, notesPushed } from "@/slicers/notesSlice";
import { notesPersisted, persistor, store } from "@/slicers/store";
import { CryptNote, tryDecryptNote } from "@/utils/crypt";
import { dekMatchesVault } from "@/utils/vault";

import { cloud, getDeviceUuid } from "./index";
import { SyncEngine, type SyncEvents, type SyncStore } from "./syncEngine";
import type { CloudDevice } from "./types";

/** What the sync engine reports to the app (UI, editors, presence). */
export type SyncEvent =
  // `openNote`: the note open in an editor here, which shows its changes live.
  | ({ type: "applied"; openNote: string | null } & Parameters<SyncEvents["onApplied"]>[0])
  | { type: "devices"; devices: CloudDevice[] }
  | { type: "removed" }
  | { type: "vaultStale" };

const listeners = new Set<(event: SyncEvent) => void>();

export const onSyncEvent = (listener: (event: SyncEvent) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const emit = (event: SyncEvent) => listeners.forEach((listener) => listener(event));

let engine: SyncEngine | null = null;

/** The app's sync engine, bound to the store and the active cloud. Null if this device has no id (storage failed). */
export const getSyncEngine = async (): Promise<SyncEngine | null> => {
  if (engine) return engine;
  const me = await getDeviceUuid();
  if (!me) return null;
  // Two concurrent first calls: keep the first engine.
  engine ??= new SyncEngine({
    backend: cloud,
    me,
    // The persisted root state types every slice as optional: they're all there once rehydrated.
    store: store as unknown as SyncStore,
    actions: {
      applyNotesPlan,
      notesPushed,
      dropNoteUploads,
      adoptLegacyOutbox,
      applyCategoriesPlan,
      categoriesPushed,
      addLocalCategories,
      deleteLocalCategories,
    },
    crypto: {
      encrypt: (note: Note) => CryptNote.encrypt(note),
      decrypt: (note: Note) => {
        const dek = getDEK();
        return dek ? tryDecryptNote(note, dek) : null;
      },
      matches: (vault) => {
        const dek = getDEK();
        return dek ? dekMatchesVault(vault, dek) : null;
      },
    },
    persist: async () => {
      await persistor.flush();
      if (!notesPersisted()) throw new Error("the notes couldn't be written");
    },
    flushEditors: flushPending,
    conflictSuffix: () => t("cloudsync.conflict_suffix"),
    events: {
      onApplied: (result) => emit({ type: "applied", ...result, openNote: engine?.openNote ?? null }),
      onDevices: (devices) => emit({ type: "devices", devices }),
      onRemoved: () => emit({ type: "removed" }),
      onVaultStale: () => emit({ type: "vaultStale" }),
    },
  });
  return engine;
};

/**
 * A full sync that didn't complete (offline, app closed) is due again: it's what brings a newly connected device the
 * notes already in the cloud, which no queue carries.
 */
const FULL_SYNC_DUE = "@cloudFullSyncDue";

/** Runs a full sync now (connect, unlock, "sync now"). False if it couldn't complete: it then runs again on the next start. */
export const syncNow = async (onProgress?: (done: number, total: number) => void): Promise<boolean> => {
  // Locked: nothing can be read or sealed (the vault screens unlock first).
  if (!getDEK()) return false;
  const sync = await getSyncEngine();
  if (!sync) return false;
  await AsyncStorage.setItem(FULL_SYNC_DUE, "1").catch(() => {});
  const ok = await sync.fullSync(onProgress);
  if (ok) await AsyncStorage.removeItem(FULL_SYNC_DUE).catch(() => {});
  return ok;
};

/** Runs the full sync left due, if any. */
export const syncIfDue = async (): Promise<void> => {
  const due = await AsyncStorage.getItem(FULL_SYNC_DUE).catch(() => null);
  if (due) await syncNow();
};
