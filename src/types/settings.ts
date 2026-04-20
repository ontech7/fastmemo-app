export interface WebhookPayload {
  url: string;
  enabled: boolean;
}

export interface Webhooks {
  addTextNote: WebhookPayload;
  addTodoNote: WebhookPayload;
  addKanbanNote: WebhookPayload;
  updateNote: WebhookPayload;
  temporaryDeleteNote: WebhookPayload;
  deleteNote: WebhookPayload;
  restoreNote: WebhookPayload;
  createCategory: WebhookPayload;
  deleteCategory: WebhookPayload;
  updateCategory: WebhookPayload;
  exportData: WebhookPayload;
  importData: WebhookPayload;
  wipeData: WebhookPayload;
}

export interface VoiceRecognitionSettings {
  enabled: boolean;
  interimResults: boolean;
  continuous: boolean;
  language: string;
}

export interface CloudSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AIAssistantSettings {
  enabled: boolean;
  modelDownloaded: boolean;
  selectedModel: "qwen-0.5b" | "qwen-1.5b" | "qwen-3b";
  voiceOnly: boolean;
}

export interface DeveloperModeSettings {
  enabled: boolean;
  unlimitedTextSpace: boolean;
  unlimitedKanbanColumns: boolean;
  unlimitedTrashTime: boolean;
  customAppIcon: string | null;
}

export interface SettingsState {
  language: string;
  isIntroFinished: boolean;
  secretCode: string;
  isFingerprintEnabled: boolean;
  showHidden: boolean;
  isCloudSyncEnabled: boolean;
  cloudConnected: boolean;
  cloud: CloudSettings;
  webhooks: Webhooks;
  voiceRecognition: VoiceRecognitionSettings;
  aiAssistant: AIAssistantSettings;
  reportDate: string | null;
  developerMode: DeveloperModeSettings;
}
