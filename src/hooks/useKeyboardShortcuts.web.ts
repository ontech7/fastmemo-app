import { useEffect } from "react";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { canRun, type DesktopCommand, IS_MAC, isEditable, press, runCommand } from "@/libs/desktopCommands";
import { isTauri } from "@/utils/platform";

/*
 * Web and desktop keys.
 *
 * Everywhere on web: Backspace outside a text field would navigate the history back, yanking the user out of the
 * current screen, so it is swallowed there.
 *
 * Desktop (Tauri) only, where the app is the whole window:
 * - Esc: in a text field it only leaves the field; otherwise it presses the screen's back button.
 * - Cmd/Ctrl+N: a new note (from another screen, going back to the home screen first); Cmd/Ctrl+F: the search field,
 *   or find in a text note; Cmd/Ctrl+,: the settings. The same commands as the macOS menu (`@/libs/desktopCommands`).
 * - F5 and Cmd/Ctrl+R would reload the page, dropping the edits not yet saved: blocked outside development.
 * - Alt+arrows (Windows, Linux) and the keyboard's back/forward keys would leave the screen through the history, without
 *   its back button: blocked.
 *
 * A shortcut presses its control (`SHORTCUT_TARGET`) only when a click would reach it: an open dialog, menu or popup
 * lying over it means the key does nothing. It never acts on a held key's repeats, while an input method is composing
 * text (Esc there cancels the composition), or, in an editor, on a key the editor already handled (CodeMirror's Esc
 * collapsing a multiple selection). React Native Web's text inputs stop their keys from bubbling, so this window listens
 * in the capture phase. The note editors run in iframes, whose keys don't reach this window at all, so they get the
 * same listeners.
 */

/** The letter a shortcut is typed with: the key's own letter, or the physical key on a non-Latin layout. */
function letterOf(e: KeyboardEvent): string {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  return e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : "";
}

const COMMAND_KEYS: Record<string, DesktopCommand> = { n: "newNote", f: "find", ",": "settings" };

/** A key that reloads the page. AltGr (Ctrl+Alt on Windows) types characters: AltGr+R isn't one. */
function isReload(e: KeyboardEvent, mod: boolean): boolean {
  return e.key === "F5" || e.key === "BrowserRefresh" || (mod && !e.altKey && letterOf(e) === "r");
}

/** A key that moves through the history. Option+arrows move by word on a Mac. */
function isHistoryKey(e: KeyboardEvent): boolean {
  if (e.key === "BrowserBack" || e.key === "BrowserForward") return true;
  return !IS_MAC && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight");
}

function onDesktopKeyDown(e: KeyboardEvent) {
  // keyCode 229: WebKit reports the key that ends a composition that way, with isComposing already false.
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;

  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  const otherMod = IS_MAC ? e.ctrlKey : e.metaKey;

  if ((!__DEV__ && isReload(e, mod)) || isHistoryKey(e)) {
    e.preventDefault();
    return;
  }

  if (e.repeat || e.altKey || e.shiftKey || otherMod) return;

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
  const command = COMMAND_KEYS[e.key === "," ? "," : letterOf(e)];
  // Handled here, the key doesn't reach the macOS menu's item for the same command.
  if (command && canRun(command)) {
    e.preventDefault();
    void runCommand(command);
  }
}

/** The note editors' iframe documents already listened to. */
const frameDocs = new WeakSet<Document>();

function listenToFrame(frame: Element | null) {
  if (frame?.tagName !== "IFRAME") return;
  // null for another origin: not one of the editors
  const doc = (frame as HTMLIFrameElement).contentDocument;
  if (!doc || frameDocs.has(doc)) return;
  frameDocs.add(doc);
  // Esc can leave the focus on the editor's page itself, where Backspace isn't editing anything.
  doc.addEventListener("keydown", onBackspace);
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
