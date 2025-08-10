// store.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import FSStorage from "redux-persist-expo-fs-storage";
import getStoredState from "redux-persist/es/getStoredState";

import categoriesReducer from "./categoriesSlice";
import notesReducer from "./notesSlice";
import settingsReducer from "./settingsSlice";

// Config persist individuale per ogni slice
const notesPersistConfig = {
  key: "notes",
  storage: FSStorage(),
  migrate: async (state) => {
    if (state === undefined) {
      // Migrazione da AsyncStorage (vecchia versione)
      const asyncState = await getStoredState({
        key: "notes",
        storage: AsyncStorage,
      });
      return asyncState;
    }
    return state;
  },
};

const categoriesPersistConfig = {
  key: "categories",
  storage: AsyncStorage,
};

const settingsPersistConfig = {
  key: "settings",
  storage: AsyncStorage,
};

// Reducer combinato con persist
const rootReducer = combineReducers({
  categories: persistReducer(categoriesPersistConfig, categoriesReducer),
  notes: persistReducer(notesPersistConfig, notesReducer),
  settings: persistReducer(settingsPersistConfig, settingsReducer),
});

const persistedReducer = persistReducer(
  {
    key: "root",
    storage: AsyncStorage,
    blacklist: [],
  },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
