export type AIModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export type AIModelId = "qwen-0.5b" | "qwen-1.5b" | "qwen-3b";

export interface AIModelInfo {
  id: AIModelId;
  name: string;
  fileName: string;
  url: string;
  sizeLabel: string;
  description: string;
}

export interface AIToolCall {
  action: string;
  params: Record<string, unknown>;
}

export interface AIResponse {
  success: boolean;
  toolCall?: AIToolCall;
  message?: string;
  error?: string;
}
