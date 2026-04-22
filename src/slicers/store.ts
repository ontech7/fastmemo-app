import FSStorage from "@/libs/storage/fsStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import { Platform } from "react-native";
import { persistReducer, persistStore } from "redux-persist";
import type { PersistConfig } from "redux-persist";
import getStoredState from "redux-persist/es/getStoredState";
import categoriesReducer from "./categoriesSlice";
import notesReducer from "./notesSlice";
import settingsReducer from "./settingsSlice";

import type { CategoriesState, NotesState, SettingsState } from "@/types";

type PersistedState = { _persist: { version: number; rehydrated: boolean } } | undefined;

const notesPersistConfig: PersistConfig<NotesState> = {
  key: "root_notes",
  storage: FSStorage(),
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
};

const settingsPersistConfig: PersistConfig<SettingsState> = {
  key: "root_settings",
  storage: AsyncStorage,
};

const rootReducer = combineReducers({
  categories: persistReducer(categoriesPersistConfig, categoriesReducer),
  notes: persistReducer(notesPersistConfig, notesReducer),
  settings: persistReducer(settingsPersistConfig, settingsReducer),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

// One-time cleanup of the legacy root-level persisted blob.
// Prior versions wrapped the already per-slice-persisted rootReducer in an
// outer persistReducer (key "root", AsyncStorage). The outer layer has been
// removed; the orphaned key is purged here so it doesn't linger on users'
// devices. Per-slice keys (persist:root_notes, persist:root_categories,
// persist:root_settings) are untouched, preserving user data.
AsyncStorage.removeItem("persist:root").catch(() => {
  // Swallow: the key may already be absent (fresh installs, web, etc.).
});

export type AppDispatch = typeof store.dispatch;
export type AppRootState = ReturnType<typeof store.getState>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
