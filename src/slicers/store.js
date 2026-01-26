import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { Platform } from "react-native";
import { persistReducer, persistStore } from "redux-persist";
import getStoredState from "redux-persist/es/getStoredState";

import { AsyncStorage, getNotesStorage } from "@/libs/storage";

import categoriesReducer from "./categoriesSlice";
import notesReducer from "./notesSlice";
import settingsReducer from "./settingsSlice";

const notesPersistConfig = {
  key: "root_notes",
  storage: getNotesStorage(),
  migrate: async (state) => {
    if (Platform.OS === "web") {
      return state;
    }
    if (state === undefined) {
      const asyncState = await getStoredState({
        key: "root_notes",
        storage: AsyncStorage,
      });
      return asyncState;
    }
    return state;
  },
};

const categoriesPersistConfig = {
  key: "root_categories",
  storage: AsyncStorage,
};

const settingsPersistConfig = {
  key: "root_settings",
  storage: AsyncStorage,
};

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
