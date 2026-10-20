import { adoptLegacySyncState } from "@/libs/cloud/revision";
import FSStorage from "@/libs/storage/fsStorage";
import { foldLegacyRootNotes } from "@/libs/storage/legacyRootNotes";
import { noteStore, notesNeedSorting } from "@/libs/storage/notes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import { Platform } from "react-native";
import { persistReducer, persistStore } from "redux-persist";
import type { PersistConfig, PersistMigrate } from "redux-persist";
import getStoredState from "redux-persist/es/getStoredState";
import categoriesReducer from "./categoriesSlice";
import notesReducer, { reorderNotes } from "./notesSlice";
import settingsReducer from "./settingsSlice";

import type { CategoriesState, NotesState, SettingsState } from "@/types";

type PersistedState = { _persist: { version: number; rehydrated: boolean } } | undefined;

// A read that throws (I/O error, out of memory on a huge file, IndexedDB connection lost) makes
// redux-persist rehydrate the empty initial state and write it straight back over every stored note.
// After one, the notes aren't written for the rest of the session: the next launch reads them again.
let notesReadFailed = false;

const failedNotesRead = (err: unknown): never => {
  notesReadFailed = true;
  console.warn("redux-persist: reading the notes failed, not writing them this session", err);
  throw err;
};

// Whether the last notes write failed: redux-persist only logs it, and its flush() resolves anyway.
let notesWriteFailed = false;

// The notes as redux-persist stored them before the note store (one value): the legacy fold below works on it.
const baseNotesStorage = FSStorage();

let reorderOnRehydrate = false;

// One stored value per note (ADR-018): a save writes only the notes that changed.
const notesStorage = noteStore && {
  getItem: (key: string) => noteStore.getItem(key).catch(failedNotesRead),
  setItem: (key: string, value: unknown) =>
    notesReadFailed
      ? Promise.resolve()
      : noteStore.setItem(key, value as Parameters<typeof noteStore.setItem>[1]).then(
          () => {
            notesWriteFailed = false;
          },
          (err: unknown) => {
            notesWriteFailed = true;
            throw err;
          }
        ),
  removeItem: (key: string) => noteStore.removeItem(key),
};

/** Whether the notes were read at launch (if not, they aren't written this session, see above). */
export const notesLoaded = (): boolean => !notesReadFailed;

/** Whether the notes as they are now are on disk, after a `persistor.flush()`. */
export const notesPersisted = (): boolean => !notesReadFailed && !notesWriteFailed;

// Every config waits for its read however long it takes (`timeout: 0`): on timeout redux-persist
// rehydrates the empty initial state, and its next write replaces what was stored with it.

// 1: the notes carry this device's sync bookkeeping (ADR-016). Older versions stored -1 (redux-persist's default).
const NOTES_VERSION = 1;

/** The notes as an older version left them, made ready for the sync engine. A failure keeps them as they were. */
const fromOlderVersion = (state: PersistedState): PersistedState => {
  if (state === undefined || (state._persist?.version ?? -1) >= NOTES_VERSION) return state;
  try {
    return adoptLegacySyncState(state as NonNullable<PersistedState> & Partial<NotesState>);
  } catch (err) {
    console.warn("redux-persist: adopting the older version's notes failed", err);
    return state;
  }
};

const notesPersistConfig: PersistConfig<NotesState> = {
  key: "root_notes",
  storage: notesStorage,
  timeout: 0,
  version: NOTES_VERSION,
  // The note store takes and gives the slice as it is: it stores each note on its own.
  serialize: false,
  deserialize: false,
  migrate: async (state: PersistedState): Promise<PersistedState> => {
    if (Platform.OS !== "web" && state === undefined) {
      const asyncState = await getStoredState({
        key: "root_notes",
        storage: AsyncStorage,
      }).catch(failedNotesRead);
      return fromOlderVersion(asyncState as PersistedState);
    }
    return fromOlderVersion(state);
  },
};

const categoriesPersistConfig: PersistConfig<CategoriesState> = {
  key: "root_categories",
  storage: AsyncStorage,
  timeout: 0,
};

const settingsPersistConfig: PersistConfig<SettingsState> = {
  key: "root_settings",
  storage: AsyncStorage,
  timeout: 0,
};

const rootReducer = combineReducers({
  categories: persistReducer(categoriesPersistConfig, categoriesReducer),
  notes: persistReducer(notesPersistConfig, notesReducer),
  settings: persistReducer(settingsPersistConfig, settingsReducer),
});

const rootPersistConfig: PersistConfig<ReturnType<typeof rootReducer>> = {
  key: "root",
  storage: AsyncStorage,
  timeout: 0,
  blacklist: [] as string[],
};

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store, { manualPersist: true }, () => {
  if (reorderOnRehydrate || notesNeedSorting()) store.dispatch(reorderNotes());
});

/** Keeps an outdated copy of the notes in the root blob (e.g. after a downgrade) from replacing them. */
const dropLegacyRootNotes: PersistMigrate = async (state) => {
  if (!state || !("notes" in state)) return state;
  const { notes: _legacyNotes, ...rest } = state as NonNullable<typeof state> & { notes?: unknown };
  return rest;
};

// Notes persist only to their own storage once their legacy copy has been folded out of the root
// blob (see foldLegacyRootNotes). Until then, nothing persists. redux-persist reads `blacklist` and
// `migrate` when persisting starts, so the root config can still be switched over here.
// The fold handles its own read errors (it then reports `null`), so it gets the unguarded storage.
foldLegacyRootNotes(baseNotesStorage).then((added) => {
  if (added !== null) {
    rootPersistConfig.blacklist = ["notes"];
    rootPersistConfig.migrate = dropLegacyRootNotes;
    if (added > 0) reorderOnRehydrate = true;
  }
  persistor.persist();
});

export type AppDispatch = typeof store.dispatch;
export type AppRootState = ReturnType<typeof store.getState>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
