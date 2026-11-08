import { useEffect } from "react";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { canRun, commandsIdle, type DesktopCommand, IS_MAC, isEditable, press, runCommand } from "@/libs/desktopCommands";
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
 *   or find in a text note. The same commands as the macOS menu (`@/libs/desktopCommands`).
 * - F5 and Cmd/Ctrl+R would reload the page, dropping the edits not yet saved: blocked outside development.
 * - Alt+arrows (Windows, Linux) and the keyboard's back/forward keys would leave the screen through the history, without
 *   its back button: blocked.
 * - The browser's own keys, which make no sense in an app window: print, find (F3, Cmd/Ctrl+G, and Cmd/Ctrl+F where the
 *   app has nothing to find), save, open, view source, zoom and caret browsing (F7). WebView2 acts on most of them.
 * - A right click opens the browser's menu (back, reload, print…) only where it edits or copies text: in a text field,
 *   or over selected text. On Windows that menu keeps only cut, copy and paste (`src-tauri/src/window_chrome.rs`).
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

const COMMAND_KEYS: Record<string, DesktopCommand> = { n: "newNote", f: "find" };

/** A key that reloads the page. AltGr (Ctrl+Alt on Windows) types characters: AltGr+R isn't one. */
function isReload(e: KeyboardEvent, mod: boolean): boolean {
  return e.key === "F5" || e.key === "BrowserRefresh" || (mod && !e.altKey && letterOf(e) === "r");
}

/** A key that moves through the history. Option+arrows move by word on a Mac. */
function isHistoryKey(e: KeyboardEvent): boolean {
  if (e.key === "BrowserBack" || e.key === "BrowserForward") return true;
  return !IS_MAC && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight");
}

/** Find next and caret browsing. */
const BROWSER_KEYS = new Set(["F3", "F7"]);
/** With Cmd/Ctrl: print, find next, save, open. */
const BROWSER_LETTERS = new Set(["p", "g", "s", "o"]);
const ZOOM_KEYS = new Set(["+", "-", "=", "0"]);

/**
 * A browser's key. Cmd on a Mac, where Ctrl+letters move the caret in text fields. Cmd/Ctrl+U is view source only outside
 * a text field: in the text editor it underlines.
 */
function isBrowserKey(e: KeyboardEvent, mod: boolean): boolean {
  if (BROWSER_KEYS.has(e.key)) return true;
  if (!mod || e.altKey) return false;
  if (ZOOM_KEYS.has(e.key) || e.code === "NumpadAdd" || e.code === "NumpadSubtract") return true;
  const letter = letterOf(e);
  return BROWSER_LETTERS.has(letter) || (letter === "u" && !isEditable(e.target));
}

function onDesktopKeyDown(e: KeyboardEvent) {
  // keyCode 229: WebKit reports the key that ends a composition that way, with isComposing already false.
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;

  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  const otherMod = IS_MAC ? e.ctrlKey : e.metaKey;

  if ((!__DEV__ && isReload(e, mod)) || isHistoryKey(e) || isBrowserKey(e, mod)) {
    e.preventDefault();
    return;
  }

  if (e.altKey || e.shiftKey || otherMod) return;
  const command = mod ? COMMAND_KEYS[letterOf(e)] : undefined;

  // A key the page leaves alone goes on to the macOS menu item with the same shortcut: a held key's repeats are stopped
  // here, or the menu would run the command again on each.
  if (e.repeat) {
    if (command) e.preventDefault();
    return;
  }

  if (e.key === "Escape" && !mod) {
    if (isEditable(e.target)) {
      (e.target as HTMLElement).blur();
      e.preventDefault();
    } else if (commandsIdle() && press(SHORTCUT_TARGET.back)) {
      e.preventDefault();
    }
    return;
  }

  if (command && canRun(command)) {
    e.preventDefault();
    void runCommand(command);
  } else if (command === "find") {
    // Nothing to find on this screen: not the browser's find bar either.
    e.preventDefault();
  }
}

function selectionOf(target: EventTarget | null): Selection | null {
  return (target as Node | null)?.ownerDocument?.getSelection() ?? null;
}

function hasSelectedText(target: EventTarget | null): boolean {
  const selection = selectionOf(target);
  return !!selection && !selection.isCollapsed && !!selection.toString().trim();
}

/** Whether the pointer is over the selected text: elsewhere the menu would be the page's (reload, back). */
function isOverSelection(e: MouseEvent): boolean {
  if (!hasSelectedText(e.target)) return false;
  const selection = selectionOf(e.target)!;
  for (let i = 0; i < selection.rangeCount; i++) {
    for (const r of selection.getRangeAt(i).getClientRects()) {
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
    }
  }
  return false;
}

/** What opens the menu: the right button, or Ctrl+click on a Mac. */
function isMenuPress(e: MouseEvent): boolean {
  return e.button === 2 || (IS_MAC && e.button === 0 && e.ctrlKey);
}

/**
 * The last press that opens a menu. WebKit on macOS selects the word under the pointer before `contextmenu`, so the
 * selection is read when the button goes down. A menu from the keyboard has no press; one whose menu never came (released
 * outside the window, on Windows where the menu opens on release) is forgotten after a moment.
 */
let menuPress: { doc: Document | null; overSelection: boolean; hadSelection: boolean; at: number } | null = null;
const PRESS_TO_MENU_MS = 1500;

function onMouseDown(e: MouseEvent) {
  if (!isMenuPress(e) || isEditable(e.target)) return;
  const overSelection = isOverSelection(e);
  const selection = selectionOf(e.target);
  menuPress = {
    doc: (e.target as Node).ownerDocument,
    overSelection,
    hadSelection: !!selection && !selection.isCollapsed,
    at: Date.now(),
  };
  // No menu will open: not WebKit's word selection either.
  if (!overSelection) e.preventDefault();
}

/** A right click: the browser's menu only over a text field or text the user selected, to edit or copy. */
function onContextMenu(e: MouseEvent) {
  const press = menuPress;
  menuPress = null;
  const fromPress =
    press && press.doc === (e.target as Node | null)?.ownerDocument && Date.now() - press.at < PRESS_TO_MENU_MS ? press : null;
  if (isEditable(e.target) || (fromPress ? fromPress.overSelection : hasSelectedText(e.target))) return;
  e.preventDefault();
  // Nothing was selected before the press: what WebKit selected for its menu (a word, a space) goes with the menu.
  const selection = selectionOf(e.target);
  if (fromPress && !fromPress.hadSelection && selection && !selection.isCollapsed) selection.removeAllRanges();
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
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("contextmenu", onContextMenu);
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
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("load", onLoadCapture, true);
    document.querySelectorAll("iframe").forEach(listenToFrame);

    return () => {
      window.removeEventListener("keydown", onBackspace);
      window.removeEventListener("keydown", onDesktopKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("load", onLoadCapture, true);
    };
  }, []);
}
