import { useSyncExternalStore } from "react";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { IS_MAC, press } from "@/libs/desktopCommands";
import { stepCursor } from "@/libs/listCursor";
import { isTauri } from "@/utils/platform";

/*
 * The home's list from the keyboard (desktop, spec C.1): a mark over one note, moved with the arrows, opened with Enter,
 * trashed with Delete (Cmd+Backspace on a Mac). The keys come from the keyboard layer (`useKeyboardShortcuts.web.ts`),
 * which only listens in the Tauri window: in a browser nothing calls these, and no card is ever marked.
 *
 * The mark lives here, outside React: a key re-renders the card that loses it and the card that gains it, nothing else
 * (each card reads only whether the mark is its own). It shows from the first arrow and hides at the first mouse move,
 * mouse press or typing in a field, keeping its place: the next arrow shows it again where it was.
 */

interface ListHost {
  /** The notes on screen, in order (a search's headings and tags left out). */
  ids: readonly string[];
  /** Asks, then trashes the note, as the selection's delete does for one note. */
  trash(noteId: string): void;
  /** Scrolls the list to a note that isn't drawn yet. */
  scrollTo(noteId: string): void;
}

let cursor: string | null = null;
let visible = false;
let host: ListHost | null = null;
/** The notes the home last listed: kept while it hands over (null, then the new list), to find what took a note's place. */
let lastIds: readonly string[] | null = null;
/** The note Enter opened: marked again when the home comes back with it still listed. */
let opened: string | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the keyboard's mark is on this note. Only the card that gains or loses it re-renders. */
export function useIsCursor(noteId: string): boolean {
  return useSyncExternalStore(subscribe, () => visible && cursor === noteId);
}

export function getCursor(): string | null {
  return cursor;
}

export function setCursor(noteId: string | null): void {
  if (noteId === cursor) return;
  cursor = noteId;
  emit();
}

/** The nearest ancestor that scrolls. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let at = node.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if ((overflowY === "auto" || overflowY === "scroll") && at.scrollHeight > at.clientHeight) return at;
  }
  return null;
}

/** Room left between the card and what covers it. */
const CLEAR_GAP = 8;

/**
 * The card lifted above what lies over the list's bottom (the selection bar, the floating buttons): "nearest" puts it at
 * the scroll area's edge, under them, where Enter's press can't reach it.
 */
function clearOverlays(card: HTMLElement) {
  const list = scrollParent(card);
  if (!list) return;
  for (let tries = 0; tries < 3; tries++) {
    const rect = card.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.bottom - 1, innerHeight - 1));
    if (!hit || card.contains(hit)) return;
    const coverTop = hit.getBoundingClientRect().top;
    // Not over its lower part, or over the whole list (a dialog): nothing to lift it above.
    if (coverTop >= rect.bottom || coverTop <= list.getBoundingClientRect().top) return;
    list.scrollTop += rect.bottom - coverTop + CLEAR_GAP;
  }
}

/** The marked card, once drawn, scrolled into view when it isn't whole on screen; a note not drawn yet, by the list. */
function revealCursor() {
  const id = cursor;
  if (!id) return;
  requestAnimationFrame(() => {
    if (cursor !== id) return;
    const card = document.querySelector<HTMLElement>(`[data-testid="${SHORTCUT_TARGET.cursorNote}"]`);
    if (!card) {
      host?.scrollTo(id);
      return;
    }
    card.scrollIntoView({ block: "nearest" });
    clearOverlays(card);
  });
}

function show(noteId: string) {
  cursor = noteId;
  visible = true;
  emit();
  revealCursor();
}

/** The home tells which notes are on screen, in order, and how to trash one; null when it loses the focus. */
export function setListHost(next: ListHost | null): void {
  const before = lastIds;
  const cameBack = host === null;
  host = next;
  if (!next) return;
  lastIds = next.ids;
  // Back from the note Enter opened (the home had gone): the mark is on it.
  if (opened !== null && cameBack) {
    const id = opened;
    opened = null;
    if (next.ids.includes(id)) return show(id);
  }
  // The marked note went (trashed, filtered out): the note that took its place is marked.
  if (cursor !== null && !next.ids.includes(cursor) && before) {
    const at = before.indexOf(cursor);
    const replacement = at >= 0 && next.ids.length ? next.ids[Math.min(at, next.ids.length - 1)] : null;
    cursor = replacement;
    if (visible && replacement) revealCursor();
    else visible = false;
    emit();
  }
}

/** A key of the list. Answers true when it used the key. */
export function listKey(key: "up" | "down" | "enter" | "delete"): boolean {
  if (!host) return false;
  if (key === "enter" || key === "delete") {
    if (!visible || cursor === null || !host.ids.includes(cursor)) return false;
    if (key === "delete") {
      host.trash(cursor);
      return true;
    }
    opened = cursor;
    if (press(SHORTCUT_TARGET.cursorNote)) return true;
    opened = null;
    return false;
  }
  // Hidden by the mouse: the arrow shows it again where it was.
  if (!visible && cursor !== null && host.ids.includes(cursor)) {
    show(cursor);
    return true;
  }
  const next = stepCursor(host.ids, visible ? cursor : null, key);
  if (next === null) return false;
  if (next === "field") {
    cursor = null;
    visible = false;
    emit();
    press(SHORTCUT_TARGET.find);
    return true;
  }
  show(next);
  return true;
}

/** The mouse moved or clicked, or a field was typed in: the mark goes. */
export function leaveKeyboardMode(): void {
  if (!visible) return;
  visible = false;
  emit();
}

/**
 * The props a card spreads on its root for the right button (spec C.2): the app's menu at the pointer, in the Tauri window
 * only (a browser keeps its own menu). On a Mac, Ctrl + click is the right button too.
 */
export function contextMenuProps(open: (at: { x: number; y: number }) => void): object {
  if (!isTauri()) return {};
  return {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      open({ x: e.clientX, y: e.clientY });
    },
  };
}

/** What a click means with its modifiers: "toggle" (Ctrl, or Cmd on the Mac), "range" (Shift), or null. */
export function clickIntent(event: unknown): "toggle" | "range" | null {
  if (!isTauri()) return null;
  const e = ((event as { nativeEvent?: unknown } | null)?.nativeEvent ?? event) as Partial<MouseEvent> | null;
  if (!e) return null;
  if (e.shiftKey) return "range";
  if (IS_MAC ? e.metaKey : e.ctrlKey) return "toggle";
  return null;
}
