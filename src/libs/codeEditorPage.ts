import { CODEMIRROR_HTML } from "@/generated/codemirror-html";
import { PAGE_ERROR_SCRIPT } from "@/libs/pageErrors";
import { SCROLLBAR_CSS } from "@/styles/scrollbar";

/** What the code note's page starts with. */
export interface CodeEditorConfig {
  code: string;
  language: string;
  readOnly: boolean;
}

/** The page's placeholder for its config (see src/editor/codemirror-entry.js). */
const CONFIG_PLACEHOLDER = "window.__EDITOR_CONFIG__=window.__EDITOR_CONFIG__||{};";

const UNSAFE_IN_SCRIPT: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * JSON that can sit inside a <script>: `<`, `>`, `&`, U+2028 and U+2029 are written as `\uXXXX` escapes, so no sequence
 * of the data can end the script (`</script>`) or open a comment (`<!--`), and the result is still the same JSON (LL-077).
 */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => UNSAFE_IN_SCRIPT[char]);
}

/**
 * Builds a code note page from `template`. Both insertions pass a function to `replace`: a replacement *string* would
 * expand `$$`, `$&`, `` $` `` and `$'` found in the code (LL-077).
 */
export function buildPageFrom(template: string, config: CodeEditorConfig): string {
  if (!template.includes(CONFIG_PLACEHOLDER)) {
    throw new Error("code editor page: the config placeholder is missing");
  }
  const script = `window.__EDITOR_CONFIG__=${serializeForScript(config)};${PAGE_ERROR_SCRIPT}`;
  const style = `<style>${SCROLLBAR_CSS}</style></head>`;
  return template.replace(CONFIG_PLACEHOLDER, () => script).replace("</head>", () => style);
}

/** The code note's page, holding the note's code exactly as it is, whatever it contains. */
export function buildCodeEditorHtml(config: CodeEditorConfig): string {
  return buildPageFrom(CODEMIRROR_HTML, config);
}
