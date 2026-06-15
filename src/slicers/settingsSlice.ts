import type {
  AIAssistantSettings,
  CloudSettings,
  DeveloperModeSettings,
  NoteCreationSettings,
  RootState,
  SettingsState,
  VoiceRecognitionSettings,
  Webhooks,
} from "@/types";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import { Platform } from "react-native";

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
    addCodeNote: { url: "", enabled: false },
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
  aiAssistant: {
    enabled: false,
    modelDownloaded: false,
    selectedModel: "qwen-0.5b",
    voiceOnly: false,
  },
  reportDate: null,
  developerMode: {
    enabled: false,
    unlimitedTextSpace: false,
    unlimitedKanbanColumns: false,
    unlimitedTrashTime: false,
    customAppIcon: null,
  },
  noteCreation: {
    mode: "simple",
    smartType: "text",
    lastUsedType: "text",
    quickNote: true,
  },
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
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
    setAIAssistant: (state, action: PayloadAction<AIAssistantSettings>) => {
      state.aiAssistant = action.payload;
    },
    setDeveloperMode: (state, action: PayloadAction<DeveloperModeSettings>) => {
      state.developerMode = action.payload;
    },
    setNoteCreation: (state, action: PayloadAction<NoteCreationSettings>) => {
      state.noteCreation = action.payload;
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
  setAIAssistant,
  setDeveloperMode,
  setNoteCreation,
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
export const selectorWebhook_addCodeNote = (state: RootState) => state.settings.webhooks.addCodeNote;
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
// Hoisted fallback defaults: returning a fresh object literal from a selector
// gives a new reference on every call, which trips React-Redux's "selector
// returned a different result with the same parameters" warning and forces
// rerenders. A stable module-level constant fixes that.
const DEFAULT_AI_ASSISTANT: AIAssistantSettings = {
  enabled: false,
  modelDownloaded: false,
  selectedModel: "qwen-0.5b",
  voiceOnly: false,
};
export const selectorAIAssistant = (state: RootState): AIAssistantSettings =>
  state.settings.aiAssistant || DEFAULT_AI_ASSISTANT;
const DEFAULT_DEVELOPER_MODE: DeveloperModeSettings = {
  enabled: false,
  unlimitedTextSpace: false,
  unlimitedKanbanColumns: false,
  unlimitedTrashTime: false,
  customAppIcon: null,
};
export const selectorDeveloperMode = (state: RootState): DeveloperModeSettings =>
  state.settings.developerMode || DEFAULT_DEVELOPER_MODE;
const DEFAULT_NOTE_CREATION: NoteCreationSettings = {
  mode: "simple",
  smartType: "text",
  lastUsedType: "text",
  quickNote: true,
};
export const selectorNoteCreation = (state: RootState): NoteCreationSettings =>
  state.settings.noteCreation || DEFAULT_NOTE_CREATION;
const WEB_VOICE_RECOGNITION: VoiceRecognitionSettings = {
  enabled: false,
  interimResults: true,
  continuous: true,
  language: "system",
};
const DEFAULT_VOICE_RECOGNITION: VoiceRecognitionSettings = {
  enabled: true,
  interimResults: true,
  continuous: true,
  language: "system",
};
export const selectorVoiceRecognition = (state: RootState): VoiceRecognitionSettings =>
  Platform.OS === "web" ? WEB_VOICE_RECOGNITION : state.settings.voiceRecognition || DEFAULT_VOICE_RECOGNITION;

export default settingsSlice.reducer;
