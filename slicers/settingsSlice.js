import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice } from "@reduxjs/toolkit";
import * as Localization from "expo-localization";
import i18n from "i18next";

const initialState = {
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
    setLanguage: (state, action) => {
      state.language = action.payload;
      AsyncStorage.setItem("@appLanguage", action.payload);
      i18n.changeLanguage(action.payload !== "system" ? action.payload : Localization.getLocales()[0].languageCode || "en");
    },
    setIsIntroFinished: (state, action) => {
      state.isIntroFinished = action.payload;
    },
    setSecretCode: (state, action) => {
      state.secretCode = action.payload;
    },
    setIsFingerprintEnabled: (state, action) => {
      state.isFingerprintEnabled = action.payload;
    },
    setShowHidden: (state, action) => {
      state.showHidden = action.payload;
    },
    setReportDate: (state, action) => {
      state.reportDate = action.payload;
    },
    setIsCloudSyncEnabled: (state, action) => {
      state.isCloudSyncEnabled = action.payload;
    },
    setCloudSettings: (state, action) => {
      state.cloud = action.payload;
    },
    setCloudConnected: (state, action) => {
      state.cloudConnected = action.payload;
    },
    setWebhooks: (state, action) => {
      state.webhooks = action.payload;
    },
    setVoiceRecognition: (state, action) => {
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

// Selectors
export const getAllSettings = (state) => state.settings;
export const selectorLanguage = (state) => state.settings.language || "system";
export const selectorIsIntroFinished = (state) => state.settings.isIntroFinished;
export const selectorCurrentSecretCode = (state) => state.settings.secretCode;
export const selectorIsFingerprintEnabled = (state) => state.settings.isFingerprintEnabled;
export const selectorShowHidden = (state) => state.settings.showHidden;
export const selectorReportDate = (state) => state.settings.reportDate;
export const selectorIsCloudSyncEnabled = (state) => state.settings.isCloudSyncEnabled;
export const getCloudSettings = (state) => state.settings.cloud;
export const getCloudConnected = (state) => state.settings.cloudConnected;
export const selectorWebhooks = (state) => state.settings.webhooks;
export const selectorWebhook_addTextNote = (state) => state.settings.webhooks.addTextNote;
export const selectorWebhook_addTodoNote = (state) => state.settings.webhooks.addTodoNote;
export const selectorWebhook_addKanbanNote = (state) => state.settings.webhooks.addKanbanNote;
export const selectorWebhook_updateNote = (state) => state.settings.webhooks.updateNote;
export const selectorWebhook_temporaryDeleteNote = (state) => state.settings.webhooks.temporaryDeleteNote;
export const selectorWebhook_deleteNote = (state) => state.settings.webhooks.deleteNote;
export const selectorWebhook_restoreNote = (state) => state.settings.webhooks.restoreNote;
export const selectorWebhook_createCategory = (state) => state.settings.webhooks.createCategory;
export const selectorWebhook_deleteCategory = (state) => state.settings.webhooks.deleteCategory;
export const selectorWebhook_updateCategory = (state) => state.settings.webhooks.updateCategory;
export const selectorWebhook_exportData = (state) => state.settings.webhooks.exportData;
export const selectorWebhook_importData = (state) => state.settings.webhooks.importData;
export const selectorWebhook_wipeData = (state) => state.settings.webhooks.wipeData;
export const selectorVoiceRecognition = (state) =>
  state.settings.voiceRecognition || {
    enabled: state.settings.voiceRecognition?.enabled || true,
    interimResults: state.settings.voiceRecognition?.interimResults || true,
    continuous: state.settings.voiceRecognition?.continuous || true,
    language: state.settings.voiceRecognition?.language || "system",
  };

export default settingsSlice.reducer;
