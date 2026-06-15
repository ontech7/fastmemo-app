export type AIModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export type AIModelId = "qwen-0.5b" | "qwen-1.5b" | "qwen-3b" | "qwen-7b";

export interface AIModelInfo {
  id: AIModelId;
  name: string;
  fileName: string;
  url: string;
  sizeLabel: string;
  description: string;
  minRamBytes: number;
  contextSize: number;
  parts?: { fileName: string; url: string }[];
}

export type EditorAction =
  | "generate_title"
  | "summarize"
  | "suggest_items"
  | "suggest_category"
  | "explain_code"
  | "add_comments"
  | "fix_grammar"
  | "shorten"
  | "translate"
  | "clean_transcript";

export interface EditorActionResult {
  success: boolean;
  text?: string;
  items?: string[];
  error?: string;
}

/** A single help topic exposed to the AI intent search: its i18n base key and
 * its (already-localized) title. */
export interface HelpCatalogEntry {
  base: string;
  title: string;
}
