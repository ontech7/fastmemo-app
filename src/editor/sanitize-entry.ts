import DOMPurify from "dompurify";

import { NOTE_HTML_CONFIG } from "./sanitizeConfig";

/*
 * Runs in the rich text editor's page (pell: a WebView on the phone, a same-origin iframe on web and desktop) before a
 * note is loaded. Every way HTML becomes DOM there (innerHTML, outerHTML, insertAdjacentHTML, execCommand("insertHTML"),
 * createContextualFragment) goes through DOMPurify first: a note can come from an import or another device, and an
 * `<img onerror>` in it would run with the app's origin (its storage, on desktop its Rust commands). Bundled into
 * `src/generated/editor-sanitize.ts` by `scripts/build-sanitize.mjs`.
 */

type Patched = Window & { __fmSanitize?: (html: unknown) => string };

(() => {
  const page = window as Patched;
  // Injected twice on Android (at the start of the page and once it loaded): once is enough.
  if (page.__fmSanitize) return;

  let busy = false;
  const clean = (value: unknown): string => {
    const html = value == null ? "" : String(value);
    // DOMPurify's own parsing: it cleans what comes out.
    if (busy) return html;
    busy = true;
    try {
      return DOMPurify.sanitize(html, NOTE_HTML_CONFIG) as string;
    } finally {
      busy = false;
    }
  };
  page.__fmSanitize = clean;

  const wrapSetter = (name: "innerHTML" | "outerHTML") => {
    const owner = Object.getOwnPropertyDescriptor(Element.prototype, name) ? Element.prototype : HTMLElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (!descriptor?.set) return;
    const set = descriptor.set;
    Object.defineProperty(owner, name, {
      ...descriptor,
      set(this: Element, value: unknown) {
        set.call(this, clean(value));
      },
    });
  };
  wrapSetter("innerHTML");
  wrapSetter("outerHTML");

  const insertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (position: InsertPosition, html: string) {
    insertAdjacentHTML.call(this, position, clean(html));
  };

  const execCommand = Document.prototype.execCommand;
  Document.prototype.execCommand = function (command: string, showUI?: boolean, value?: string) {
    const html = String(command).toLowerCase() === "inserthtml";
    return execCommand.call(this, command, showUI, html ? clean(value) : value);
  };

  const createContextualFragment = Range.prototype.createContextualFragment;
  Range.prototype.createContextualFragment = function (html: string) {
    return createContextualFragment.call(this, clean(html));
  };
})();
