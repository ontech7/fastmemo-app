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

export type EditorAction =
  | "generate_title"
  | "summarize"
  | "continue_writing"
  | "suggest_items"
  | "suggest_category"
  | "format_text";

export interface EditorActionResult {
  success: boolean;
  text?: string;
  items?: string[];
  error?: string;
}
