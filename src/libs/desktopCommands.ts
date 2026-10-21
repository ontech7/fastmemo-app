import { router } from "expo-router";
import type { Href } from "expo-router";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";

/*
 * What the desktop keyboard shortcuts and the macOS menu do. Web only (it reads the DOM): imported by `.web.ts` files.
 *
 * A command presses a control on screen, marked with a `SHORTCUT_TARGET` testID (`data-testid` on web), and only when a
 * click would reach it: on screen, with nothing (a dialog, a menu, a dimmed overlay) over its center. A command that
 * needs the home screen first gets there by pressing the back buttons one screen at a time, the same path (and the same
 * saves) as clicking them; a screen whose back button is off (`BackButton shortcut={false}`) or covered stops it.
 */

export type DesktopCommand = "newNote" | "find" | "settings" | "help";

export const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);

/** The most screens a command goes back through to reach the home screen. */
const MAX_BACK_STEPS = 8;
/** How long one screen may take to go away after its back button is pressed. */
const BACK_TIMEOUT_MS = 1000;

const ROUTES: Partial<Record<DesktopCommand, Href>> = {
  settings: "/settings/general",
  help: "/settings/help",
};

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

/** Whether `command` can do anything now: its control is reachable, or the home screen is (directly or going back). */
export function canRun(command: DesktopCommand): boolean {
  if (command === "find") return !!reachableTarget(SHORTCUT_TARGET.find);
  if (command === "newNote" && reachableTarget(SHORTCUT_TARGET.newNote)) return true;
  return isHome() || !!reachableTarget(SHORTCUT_TARGET.back);
}

export async function runCommand(command: DesktopCommand): Promise<void> {
  // Find acts where there's something to search; it doesn't leave the screen.
  if (command === "find") {
    press(SHORTCUT_TARGET.find);
    return;
  }
  if (command === "newNote" && press(SHORTCUT_TARGET.newNote)) return;
  if (!(await goHome())) return;

  const route = ROUTES[command];
  if (route) router.push(route);
  else press(SHORTCUT_TARGET.newNote);
}
