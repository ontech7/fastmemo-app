import { useSyncExternalStore } from "react";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { press } from "@/libs/desktopCommands";
import { stepCursor } from "@/libs/listCursor";

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

/** The marked card, once drawn, scrolled into view when it isn't whole on screen; a note not drawn yet, by the list. */
function revealCursor() {
  const id = cursor;
  if (!id) return;
  requestAnimationFrame(() => {
    if (cursor !== id) return;
    const card = document.querySelector<HTMLElement>(`[data-testid="${SHORTCUT_TARGET.cursorNote}"]`);
    if (card) card.scrollIntoView({ block: "nearest" });
    else host?.scrollTo(id);
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
