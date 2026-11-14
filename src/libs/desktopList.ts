/*
 * The home's list from the keyboard is the desktop's (`desktopList.web.ts`): on the phone no card is ever marked and the
 * rest does nothing.
 */

export function useIsCursor(_noteId: string): boolean {
  return false;
}

export function getCursor(): string | null {
  return null;
}

export function setCursor(_noteId: string | null): void {}

export function setListHost(
  _host: { ids: readonly string[]; trash(noteId: string): void; scrollTo(noteId: string): void } | null
): void {}

export function listKey(_key: "up" | "down" | "enter" | "delete"): boolean {
  return false;
}

export function leaveKeyboardMode(): void {}

export function contextMenuProps(_open: (at: { x: number; y: number }) => void): object {
  return {};
}

export function clickIntent(_event: unknown): "toggle" | "range" | null {
  return null;
}
