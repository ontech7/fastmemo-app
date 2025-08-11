import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isIntroFinished: false,
  secretCode: "1234",
  gridSize: 1,
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
  reportDate: null,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setIsIntroFinished: (state, action) => {
      state.isIntroFinished = action.payload;
    },
    setGridSize: (state, action) => {
      state.gridSize = action.payload;
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
  },
});

export const {
  setIsIntroFinished,
  setGridSize,
  setSecretCode,
  setIsFingerprintEnabled,
  setShowHidden,
  setReportDate,
  setIsCloudSyncEnabled,
  setCloudSettings,
  setCloudConnected,
  setWebhooks,
} = settingsSlice.actions;

// Selectors
export const getAllSettings = (state) => state.settings;
export const selectorIsIntroFinished = (state) => state.settings.isIntroFinished;
export const selectorGridSize = (state) => state.settings.gridSize;
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

export default settingsSlice.reducer;
