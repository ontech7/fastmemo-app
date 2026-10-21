/**
 * The controls a desktop keyboard shortcut presses, marked with `testID` (`data-testid` on web). A shortcut acts only when
 * its control is on screen and nothing covers it, so it does exactly what a click there would (see `useKeyboardShortcuts`).
 */
export const SHORTCUT_TARGET = {
  /** Esc. */
  back: "shortcut-back",
  /** Cmd/Ctrl+N. */
  newNote: "shortcut-new-note",
  /** Cmd/Ctrl+F: a search field is focused, a button is pressed. */
  find: "shortcut-find",
} as const;
