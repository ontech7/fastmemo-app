import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk } from "@reduxjs/toolkit";
import * as Localization from "expo-localization";
import i18n from "i18next";

import type { AppRootState } from "@/slicers/store";

import { setLanguage } from "@/slicers/settingsSlice";

/**
 * Changes the app language.
 *
 * Dispatches the pure `setLanguage` action to update Redux state, then runs
 * the side effects (persist the raw choice in AsyncStorage and switch i18next
 * to the resolved locale). Keeping this logic here guarantees the reducer
 * stays pure.
 */
export const setLanguageThunk = createAsyncThunk<string, string, { state: AppRootState }>(
  "settings/setLanguageThunk",
  async (language, { dispatch }) => {
    dispatch(setLanguage(language));

    await AsyncStorage.setItem("@appLanguage", language);

    const resolved = language !== "system" ? language : Localization.getLocales()[0].languageCode || "en";

    await i18n.changeLanguage(resolved);

    return language;
  }
);
