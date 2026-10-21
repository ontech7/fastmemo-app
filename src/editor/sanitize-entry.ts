import DOMPurify from "dompurify";

import { addNoteHooks, NOTE_HTML_CONFIG } from "./sanitizeConfig";

/*
 * Runs in the rich text editor's page (pell: a WebView on the phone, a same-origin iframe on web and desktop) before a
 * note is loaded. Every way HTML becomes DOM there (innerHTML, outerHTML, insertAdjacentHTML, execCommand("insertHTML"),
 * createContextualFragment, setHTMLUnsafe) goes through DOMPurify first: a note can come from an import or another
 * device, and an `<img onerror>` in it would run with the app's origin (its storage, on desktop its Rust commands).
 * Bundled into `src/generated/editor-sanitize.ts` by `scripts/build-sanitize.mjs`.
 */

type Patched = Window & { __fmSanitize?: (html: unknown) => string };

(() => {
  const page = window as Patched;
  // Injected twice on Android (at the start of the page and once it loaded): once is enough.
  if (page.__fmSanitize) return;

  addNoteHooks(DOMPurify);
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

  const wrapSetter = (owner: object | undefined, name: "innerHTML" | "outerHTML") => {
    const descriptor = owner && Object.getOwnPropertyDescriptor(owner, name);
    if (!owner || !descriptor?.set) return;
    const set = descriptor.set;
    Object.defineProperty(owner, name, {
      ...descriptor,
      set(this: Node, value: unknown) {
        set.call(this, clean(value));
      },
    });
  };
  const elementOwner = (name: string) =>
    Object.getOwnPropertyDescriptor(Element.prototype, name) ? Element.prototype : HTMLElement.prototype;
  wrapSetter(elementOwner("innerHTML"), "innerHTML");
  wrapSetter(elementOwner("outerHTML"), "outerHTML");
  wrapSetter(window.ShadowRoot?.prototype, "innerHTML");

  // A method whose first argument (`at` = 1: the second) is HTML; skipped where the browser doesn't have it.
  const wrapMethod = (owner: object | undefined, name: string, at = 0) => {
    const target = owner as Record<string, unknown> | undefined;
    const original = target?.[name];
    if (typeof original !== "function") return;
    target![name] = function (this: unknown, ...args: unknown[]) {
      if (args.length > at) args[at] = clean(args[at]);
      return original.apply(this, args);
    };
  };
  wrapMethod(Element.prototype, "insertAdjacentHTML", 1);
  wrapMethod(Range.prototype, "createContextualFragment");
  wrapMethod(Element.prototype, "setHTMLUnsafe");
  wrapMethod(window.ShadowRoot?.prototype, "setHTMLUnsafe");
  wrapMethod(Document, "parseHTMLUnsafe");

  const execCommand = Document.prototype.execCommand;
  Document.prototype.execCommand = function (command: string, showUI?: boolean, value?: string) {
    const html = String(command).toLowerCase() === "inserthtml";
    return execCommand.call(this, command, showUI, html ? clean(value) : value);
  };

  // HTML dragged in from elsewhere is dropped by the browser itself, past every hook: it comes in as text, like a paste
  // (`pasteAsPlainText`). A drag within the note keeps moving its own, already clean, content.
  const rangeAt = (x: number, y: number): Range | null => {
    const position = document.caretPositionFromPoint?.(x, y);
    if (!position) return document.caretRangeFromPoint?.(x, y) ?? null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    return range;
  };
  let draggingHere = false;
  document.addEventListener("dragstart", () => (draggingHere = true), true);
  document.addEventListener("dragend", () => (draggingHere = false), true);
  document.addEventListener(
    "drop",
    (event) => {
      const data = event.dataTransfer;
      if (draggingHere || !data?.types.includes("text/html")) return;
      event.preventDefault();
      const text = data.getData("text/plain");
      const at = rangeAt(event.clientX, event.clientY);
      const selection = window.getSelection();
      if (at && selection) {
        selection.removeAllRanges();
        selection.addRange(at);
      }
      if (text) execCommand.call(document, "insertText", false, text);
    },
    true
  );

  // On web and desktop the editor is an iframe of the app: pell runs the commands it gets by `postMessage` (as code),
  // from any window. Only the app's are read; another window's message reads as an empty one. A getter rather than a
  // listener: pell's listener was added before this script ran.
  if (window.parent !== window) {
    const descriptor = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    const read = descriptor?.get;
    if (descriptor && read) {
      Object.defineProperty(MessageEvent.prototype, "data", {
        ...descriptor,
        get(this: MessageEvent) {
          const source = this.source;
          if (source && source !== window && source !== window.parent) return "{}";
          return read.call(this);
        },
      });
    }
  }
})();
