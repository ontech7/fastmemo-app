import { router } from "expo-router";
import type { Href } from "expo-router";

import { noteTypeTarget, SHORTCUT_TARGET } from "@/constants/shortcuts";

/*
 * What the desktop keyboard shortcuts and the macOS menu do. Web only (it reads the DOM): imported by `.web.ts` files.
 *
 * A command presses a control on screen, marked with a `SHORTCUT_TARGET` testID (`data-testid` on web), and only when a
 * click would reach it: on screen, with nothing (a dialog, a menu, a dimmed overlay) over its center. A command that
 * needs the home screen first gets there by pressing the back buttons one screen at a time, the same path (and the same
 * saves) as clicking them; a screen whose back button is off (`BackButton shortcut={false}`) or covered stops it. Leaving a
 * screen this way drops what was typed in a form there, as clicking back would (the note editors save as they go).
 *
 * One command at a time, with a pause after one that changed screen (a second Cmd+N would otherwise close the note the
 * first one opened), and none while a native open/save panel is up (`withNativeDialog`): the page can't see it.
 */

export type DesktopCommand = "newNote" | "newText" | "newTodo" | "newKanban" | "newCode" | "find" | "settings" | "help";

export const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);

/** The most screens a command goes back through to reach the home screen. */
const MAX_BACK_STEPS = 8;
/** How long one screen may take to go away after its back button is pressed. */
const BACK_TIMEOUT_MS = 1000;
/** How long the note-type menu may take to open. */
const MENU_TIMEOUT_MS = 1000;

/** The pause after a command that changed screen (as `useRouter`'s guard on pushes). */
const COMMAND_PAUSE_MS = 1000;

let running = false;
let pausedUntil = 0;
let nativeDialogs = 0;

/** Whether a command may start now. */
export const commandsIdle = () => !running && nativeDialogs === 0 && Date.now() >= pausedUntil;

/** Runs `task`, which shows a native open/save panel, with the commands held until it's done. */
export async function withNativeDialog<T>(task: () => Promise<T>): Promise<T> {
  nativeDialogs++;
  try {
    return await task();
  } finally {
    nativeDialogs--;
  }
}

export function isEditable(node: EventTarget | null): boolean {
  const element = node as HTMLElement | null;
  if (!element || !element.tagName) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || element.isContentEditable === true;
}

/** Whether a click at the node's center would reach it. */
function isReachable(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return !!hit && node.contains(hit);
}

/** The control marked `name` that a click would reach. */
function reachableTarget(name: string): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>(`[data-testid="${name}"]`)) {
    if (isReachable(node)) return node;
  }
  return null;
}

/** Presses the control marked `name` (a field is focused instead), if it's reachable. */
export function press(name: string): boolean {
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

function until(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (condition()) resolve(true);
      else if (Date.now() - start > timeoutMs) resolve(false);
      else setTimeout(check, 16);
    };
    check();
  });
}

const isHome = () => !!reachableTarget(SHORTCUT_TARGET.newNote);

/** Presses the back buttons until the home screen shows. False if one is off, covered, or the screen doesn't go. */
async function goHome(): Promise<boolean> {
  for (let step = 0; step < MAX_BACK_STEPS; step++) {
    if (isHome()) return true;
    const back = reachableTarget(SHORTCUT_TARGET.back);
    if (!back) return false;
    back.click();
    // The screen goes away, or (home's FAB ending the selection) the button stops being a back button.
    const left = await until(() => back.dataset.testid !== SHORTCUT_TARGET.back || !isReachable(back), BACK_TIMEOUT_MS);
    if (!left) return false;
  }
  return isHome();
}

/** The screen a command opens from the home screen, and the home control a click would go through. */
const DESTINATIONS: Record<Exclude<DesktopCommand, "find">, { path: string | null; target: string }> = {
  newNote: { path: null, target: SHORTCUT_TARGET.newNote },
  newText: { path: null, target: SHORTCUT_TARGET.noteTypes },
  newTodo: { path: null, target: SHORTCUT_TARGET.noteTypes },
  newKanban: { path: null, target: SHORTCUT_TARGET.noteTypes },
  newCode: { path: null, target: SHORTCUT_TARGET.noteTypes },
  settings: { path: "/settings/general", target: SHORTCUT_TARGET.settings },
  // Help is reached through the settings: the settings button must be reachable too.
  help: { path: "/settings/help", target: SHORTCUT_TARGET.settings },
};

/** The note type a "new ... note" command picks in the note-type menu. */
const NOTE_TYPE_OF: Partial<Record<DesktopCommand, string>> = {
  newText: "text",
  newTodo: "todo",
  newKanban: "kanban",
  newCode: "code",
};

const isAt = (path: string | null) => !!path && window.location.pathname === path;

/** Whether `command` can do anything now: its control is reachable, or the home screen is (directly or going back). */
export function canRun(command: DesktopCommand): boolean {
  if (!commandsIdle()) return false;
  if (command === "find") return !!reachableTarget(SHORTCUT_TARGET.find);
  if (isAt(DESTINATIONS[command].path)) return false;
  if (NOTE_TYPE_OF[command] && reachableTarget(noteTypeTarget(NOTE_TYPE_OF[command]))) return true;
  if (reachableTarget(DESTINATIONS[command].target)) return true;
  return !!reachableTarget(SHORTCUT_TARGET.back);
}

export async function runCommand(command: DesktopCommand): Promise<void> {
  if (!commandsIdle()) return;
  // Find acts where there's something to search; it doesn't leave the screen.
  if (command === "find") {
    press(SHORTCUT_TARGET.find);
    return;
  }
  const { path, target } = DESTINATIONS[command];
  if (isAt(path)) return;

  const item = NOTE_TYPE_OF[command] && noteTypeTarget(NOTE_TYPE_OF[command]);

  running = true;
  try {
    // The note-type menu is already open.
    if (item && press(item)) return;
    if (!reachableTarget(target) && !(await goHome())) return;
    if (command === "help") {
      if (reachableTarget(target)) router.push(path as Href);
    } else if (item) {
      // Open the note-type menu, then pick the type, as two clicks would.
      if (press(target) && (await until(() => !!reachableTarget(item), MENU_TIMEOUT_MS))) press(item);
    } else {
      press(target);
    }
  } finally {
    running = false;
    pausedUntil = Date.now() + COMMAND_PAUSE_MS;
  }
}
