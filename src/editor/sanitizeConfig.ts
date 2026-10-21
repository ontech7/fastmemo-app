import type { Config } from "dompurify";

/**
 * What DOMPurify keeps of a note's HTML: everything the editor (pell) and the app write, nothing that runs (LL-060).
 * Used inside the editor's page (`sanitize-entry.ts`) and before the web build renders a note for the PDF export.
 */
export const NOTE_HTML_CONFIG: Config = {
  // The to-do box is wrapped in `contenteditable="false"`: without it the caret would go into the box. `target` on a
  // pasted link is harmless.
  ADD_ATTR: ["contenteditable", "target"],
  // A link to an app (obsidian:, spotify:) keeps working; `javascript:` and the like are still removed, and `data:` is
  // kept only where DOMPurify allows it (images, the editor's own).
  ALLOW_UNKNOWN_PROTOCOLS: true,
};
