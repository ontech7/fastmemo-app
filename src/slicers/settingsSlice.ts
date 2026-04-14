import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { Platform } from "react-native";

import type { CloudSettings, RootState, SettingsState, VoiceRecognitionSettings, Webhooks } from "@/types";

const initialState: SettingsState = {
  language: "system",
  isIntroFinished: false,
  secretCode: "1234",
  isFingerprintEnabled: false,
  showHidden: false,
  isCloudSyncEnabled: false,
  cloudConnected: false,
  cloud: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  webhooks: {
    addTextNote: { url: "", enabled: false },
    addTodoNote: { url: "", enabled: false },
    addKanbanNote: { url: "", enabled: false },
    updateNote: { url: "", enabled: false },
    temporaryDeleteNote: { url: "", enabled: false },
    deleteNote: { url: "", enabled: false },
    restoreNote: { url: "", enabled: false },
    createCategory: { url: "", enabled: false },
    deleteCategory: { url: "", enabled: false },
    updateCategory: { url: "", enabled: false },
    exportData: { url: "", enabled: false },
    importData: { url: "", enabled: false },
    wipeData: { url: "", enabled: false },
  },
  voiceRecognition: {
    enabled: true,
    interimResults: true,
    continuous: true,
    language: "system",
  },
  reportDate: null,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
      AsyncStorage.setItem("@appLanguage", action.payload);
      i18n.changeLanguage(action.payload !== "system" ? action.payload : Localization.getLocales()[0].languageCode || "en");
    },
    setIsIntroFinished: (state, action: PayloadAction<boolean>) => {
      state.isIntroFinished = action.payload;
    },
    setSecretCode: (state, action: PayloadAction<string>) => {
      state.secretCode = action.payload;
    },
    setIsFingerprintEnabled: (state, action: PayloadAction<boolean>) => {
      state.isFingerprintEnabled = action.payload;
    },
    setShowHidden: (state, action: PayloadAction<boolean>) => {
      state.showHidden = action.payload;
    },
    setReportDate: (state, action: PayloadAction<string | null>) => {
      state.reportDate = action.payload;
    },
    setIsCloudSyncEnabled: (state, action: PayloadAction<boolean>) => {
      state.isCloudSyncEnabled = action.payload;
    },
    setCloudSettings: (state, action: PayloadAction<CloudSettings>) => {
      state.cloud = action.payload;
    },
    setCloudConnected: (state, action: PayloadAction<boolean>) => {
      state.cloudConnected = action.payload;
    },
    setWebhooks: (state, action: PayloadAction<Webhooks>) => {
      state.webhooks = action.payload;
    },
    setVoiceRecognition: (state, action: PayloadAction<VoiceRecognitionSettings>) => {
      state.voiceRecognition = action.payload;
    },
  },
});

export const {
  setLanguage,
  setIsIntroFinished,
  setSecretCode,
  setIsFingerprintEnabled,
  setShowHidden,
  setReportDate,
  setIsCloudSyncEnabled,
  setCloudSettings,
  setCloudConnected,
  setWebhooks,
  setVoiceRecognition,
} = settingsSlice.actions;

export const getAllSettings = (state: RootState): SettingsState => state.settings;
export const selectorLanguage = (state: RootState): string => state.settings.language || "system";
export const selectorIsIntroFinished = (state: RootState): boolean => state.settings.isIntroFinished;
export const selectorCurrentSecretCode = (state: RootState): string => state.settings.secretCode;
export const selectorIsFingerprintEnabled = (state: RootState): boolean => state.settings.isFingerprintEnabled;
export const selectorShowHidden = (state: RootState): boolean => state.settings.showHidden;
export const selectorReportDate = (state: RootState): string | null => state.settings.reportDate;
export const selectorIsCloudSyncEnabled = (state: RootState): boolean => state.settings.isCloudSyncEnabled;
export const getCloudSettings = (state: RootState): CloudSettings => state.settings.cloud;
export const getCloudConnected = (state: RootState): boolean => state.settings.cloudConnected;
export const selectorWebhooks = (state: RootState): Webhooks => state.settings.webhooks;
export const selectorWebhook_addTextNote = (state: RootState) => state.settings.webhooks.addTextNote;
export const selectorWebhook_addTodoNote = (state: RootState) => state.settings.webhooks.addTodoNote;
export const selectorWebhook_addKanbanNote = (state: RootState) => state.settings.webhooks.addKanbanNote;
export const selectorWebhook_updateNote = (state: RootState) => state.settings.webhooks.updateNote;
export const selectorWebhook_temporaryDeleteNote = (state: RootState) => state.settings.webhooks.temporaryDeleteNote;
export const selectorWebhook_deleteNote = (state: RootState) => state.settings.webhooks.deleteNote;
export const selectorWebhook_restoreNote = (state: RootState) => state.settings.webhooks.restoreNote;
export const selectorWebhook_createCategory = (state: RootState) => state.settings.webhooks.createCategory;
export const selectorWebhook_deleteCategory = (state: RootState) => state.settings.webhooks.deleteCategory;
export const selectorWebhook_updateCategory = (state: RootState) => state.settings.webhooks.updateCategory;
export const selectorWebhook_exportData = (state: RootState) => state.settings.webhooks.exportData;
export const selectorWebhook_importData = (state: RootState) => state.settings.webhooks.importData;
export const selectorWebhook_wipeData = (state: RootState) => state.settings.webhooks.wipeData;
export const selectorVoiceRecognition = (state: RootState): VoiceRecognitionSettings =>
  Platform.OS === "web"
    ? {
        enabled: false,
        interimResults: true,
        continuous: true,
        language: "system",
      }
    : state.settings.voiceRecognition || {
        enabled: state.settings.voiceRecognition?.enabled || true,
        interimResults: state.settings.voiceRecognition?.interimResults || true,
        continuous: state.settings.voiceRecognition?.continuous || true,
        language: state.settings.voiceRecognition?.language || "system",
      };

export default settingsSlice.reducer;
