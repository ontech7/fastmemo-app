import type { Config, DOMPurify } from "dompurify";

/**
 * What DOMPurify keeps of a note's HTML: what the editor (pell) and the app write, nothing that runs or poses as the
 * app (LL-060, ADR-021). Used inside the editor's page (`sanitize-entry.ts`) and before the web build renders a note for
 * the PDF export, always with `addNoteHooks`.
 */
export const NOTE_HTML_CONFIG: Config = {
  // The to-do box is wrapped in `contenteditable="false"`: without it the caret would go into the box.
  ADD_ATTR: ["contenteditable"],
  // Nothing a note needs and a fake screen would (a password form in a read-only note): forms and their controls,
  // dialogs, style sheets. An `<input>` stays only as a to-do box (`addNoteHooks`).
  FORBID_TAGS: ["form", "button", "select", "option", "optgroup", "datalist", "textarea", "dialog", "style", "link", "meta"],
  FORBID_ATTR: ["popover", "popovertarget", "popovertargetaction", "formaction", "autofocus"],
  // An image saved by an old version may point to a file (`file:`, `content:`), a link to an app (`obsidian:`):
  // kept. `javascript:` and the like are still removed, and `addNoteHooks` drops the link schemes that reach into the
  // phone or this app.
  ALLOW_UNKNOWN_PROTOCOLS: true,
};

/** Links that open an Android intent, a file, or a screen of this app instead of a page. */
const UNSAFE_LINK = /^(intent|android-app|file|content|fastmemoapp|fastmemoapptest|exp\+[\w.+-]*):/i;
/** What a URL parser skips (a tab or a newline anywhere, spaces and controls around): `in&#9;tent:` is `intent:`. */
const URL_IGNORED = /[\u0000- ]/g;

/** The checks the config can't express. Once per DOMPurify instance. */
export function addNoteHooks(purify: DOMPurify): void {
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    if (element.nodeName === "INPUT" && element.getAttribute("type")?.toLowerCase() !== "checkbox") {
      element.setAttribute("type", "checkbox");
    }
    for (const name of ["href", "xlink:href"]) {
      const url = element.getAttribute(name);
      if (url && UNSAFE_LINK.test(url.replace(URL_IGNORED, ""))) element.removeAttribute(name);
    }
    // Nothing lifted out of the note's flow (an overlay over the editor). The browser's own parsing of the style: a
    // pattern would miss `p\osition` or a comment before it.
    if (element.style?.position) element.style.removeProperty("position");
  });
}
