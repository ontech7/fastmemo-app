import FSStorage from "@/libs/storage/fsStorage";
import { foldLegacyRootNotes } from "@/libs/storage/legacyRootNotes";
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

const notesStorage = FSStorage();

// redux-persist serializes every key again right after rehydrating it: all notes, on every boot,
// though nothing changed. Rehydrated values remember the JSON they came from, reused for as long as
// they're still in the state, and so does the stored file as a whole (FSStorage then also skips
// writing it back).
const rehydratedJson = new WeakMap<object, string>();
let rehydratedFile: { keys: Record<string, string>; json: string } | null = null;

/** The file itself, rather than a key: redux-persist stores every key's value as a JSON string. */
const isPersistedFile = (value: object): value is Record<string, string> =>
  typeof (value as { _persist?: unknown })._persist === "string";

const deserializeNotes = (json: string): unknown => {
  const value = JSON.parse(json);
  if (value !== null && typeof value === "object") {
    rehydratedJson.set(value, json);
    if (isPersistedFile(value)) rehydratedFile = { keys: value, json };
  }
  return value;
};

const serializeNotes = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (isPersistedFile(value)) {
    // Only its first write can match what was read; don't hold on to the file any longer.
    const file = rehydratedFile;
    rehydratedFile = null;
    const keys = Object.keys(value);
    const fileKeys = file ? Object.keys(file.keys) : [];
    if (
      file &&
      keys.length === fileKeys.length &&
      keys.every((key, i) => key === fileKeys[i] && value[key] === file.keys[key])
    ) {
      return file.json;
    }
  }

  return rehydratedJson.get(value) ?? JSON.stringify(value);
};

// Every config waits for its read however long it takes (`timeout: 0`): on timeout redux-persist
// rehydrates the empty initial state, and its next write replaces what was stored with it.

const notesPersistConfig: PersistConfig<NotesState> = {
  key: "root_notes",
  storage: notesStorage,
  timeout: 0,
  // @ts-expect-error -- redux-persist 6 accepts a function here (createPersistoid.js), its typings only `boolean`
  serialize: serializeNotes,
  deserialize: deserializeNotes,
  migrate: async (state: PersistedState): Promise<PersistedState> => {
    if (Platform.OS === "web") {
      return state;
    }
    if (state === undefined) {
      const asyncState = await getStoredState({
        key: "root_notes",
        storage: AsyncStorage,
      });
      return asyncState as PersistedState;
    }
    return state;
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

let reorderOnRehydrate = false;

export const persistor = persistStore(store, { manualPersist: true }, () => {
  if (reorderOnRehydrate) store.dispatch(reorderNotes());
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
foldLegacyRootNotes(notesStorage).then((added) => {
  if (added !== null) {
    rootPersistConfig.blacklist = ["notes"];
    rootPersistConfig.migrate = dropLegacyRootNotes;
    reorderOnRehydrate = added > 0;
  }
  persistor.persist();
});

export type AppDispatch = typeof store.dispatch;
export type AppRootState = ReturnType<typeof store.getState>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
