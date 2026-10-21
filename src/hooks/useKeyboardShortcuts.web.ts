import { useEffect } from "react";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { isTauri } from "@/utils/platform";

/*
 * Web and desktop keys.
 *
 * Everywhere on web: Backspace outside a text field would navigate the history back, yanking the user out of the
 * current screen, so it is swallowed there.
 *
 * Desktop (Tauri) only, where the app is the whole window:
 * - Esc: in a text field it only leaves the field; otherwise it presses the screen's back button.
 * - Cmd/Ctrl+N presses the new-note button, Cmd/Ctrl+F focuses the search field (or opens find in a note).
 * - F5 and Cmd/Ctrl+R would reload the page, dropping the edits not yet saved: blocked outside development.
 *
 * A shortcut presses its control (`SHORTCUT_TARGET`) only when the control is on screen and nothing covers it: an open
 * dialog, menu or popup lies over it, so the key does nothing then. It never acts while an input method is composing
 * text (Esc there cancels the composition) or on a key the page already handled (e.g. the code editor closing its
 * suggestions). React Native Web's text inputs stop their keys from bubbling, so this window listens in the capture
 * phase. The note editors run in iframes, whose keys don't reach this window at all, so they get the same listener.
 */

const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);

function isEditable(node: EventTarget | null): boolean {
  const element = node as HTMLElement | null;
  if (!element || !element.tagName) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || element.isContentEditable === true;
}

/** The letter a shortcut is typed with: the key's own letter, or the physical key on a non-Latin layout. */
function letterOf(e: KeyboardEvent): string {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  return e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : "";
}

/** The control marked `name` that a click would reach: on screen, with nothing over its center. */
function reachableTarget(name: string): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>(`[data-testid="${name}"]`)) {
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (hit && node.contains(hit)) return node;
  }
  return null;
}

/** Presses the control marked `name` (a field is focused instead), if it's reachable. */
function press(name: string): boolean {
  const node = reachableTarget(name);
  if (!node) return false;
  if (isEditable(node)) {
    node.focus();
    if (node instanceof HTMLInputElement) node.select();
  } else {
    node.click();
  }
  return true;
}

function onDesktopKeyDown(e: KeyboardEvent) {
  // keyCode 229: WebKit reports the key that ends a composition that way, with isComposing already false.
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;

  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  const otherMod = IS_MAC ? e.ctrlKey : e.metaKey;

  if (!__DEV__ && (e.key === "F5" || e.key === "BrowserRefresh" || (mod && letterOf(e) === "r"))) {
    e.preventDefault();
    return;
  }

  if (e.altKey || e.shiftKey || otherMod) return;

  if (e.key === "Escape" && !mod) {
    if (isEditable(e.target)) {
      (e.target as HTMLElement).blur();
      e.preventDefault();
    } else if (press(SHORTCUT_TARGET.back)) {
      e.preventDefault();
    }
    return;
  }

  if (!mod) return;
  const letter = letterOf(e);
  if (letter === "n" && press(SHORTCUT_TARGET.newNote)) e.preventDefault();
  else if (letter === "f" && press(SHORTCUT_TARGET.find)) e.preventDefault();
}

/** The note editors' iframe documents already listened to. */
const frameDocs = new WeakSet<Document>();

function listenToFrame(frame: Element | null) {
  if (frame?.tagName !== "IFRAME") return;
  let doc: Document | null = null;
  try {
    doc = (frame as HTMLIFrameElement).contentDocument;
  } catch {
    return; // another origin: not one of the editors
  }
  if (!doc || frameDocs.has(doc)) return;
  frameDocs.add(doc);
  doc.addEventListener("keydown", onDesktopKeyDown);
}

// `load` doesn't bubble, but a capturing listener on the document sees every iframe (re)load.
function onLoadCapture(e: Event) {
  listenToFrame(e.target as Element);
}

function onBackspace(e: KeyboardEvent) {
  if (e.key !== "Backspace") return;
  if (isEditable(e.target)) return;
  e.preventDefault();
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    window.addEventListener("keydown", onBackspace);
    if (!isTauri()) return () => window.removeEventListener("keydown", onBackspace);

    window.addEventListener("keydown", onDesktopKeyDown, true);
    document.addEventListener("load", onLoadCapture, true);
    document.querySelectorAll("iframe").forEach(listenToFrame);

    return () => {
      window.removeEventListener("keydown", onBackspace);
      window.removeEventListener("keydown", onDesktopKeyDown, true);
      document.removeEventListener("load", onLoadCapture, true);
    };
  }, []);
}
