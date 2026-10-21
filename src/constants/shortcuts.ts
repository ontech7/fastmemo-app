/**
 * The controls a desktop command (a keyboard shortcut, a macOS menu item) presses, marked with `testID` (`data-testid` on
 * web). A command acts only when its control is on screen and nothing covers it, so it does what a click there would (see
 * `@/libs/desktopCommands`).
 */
export const SHORTCUT_TARGET = {
  /** Esc. */
  back: "shortcut-back",
  /** Cmd/Ctrl+N. */
  newNote: "shortcut-new-note",
  /** Cmd/Ctrl+F: a search field is focused, a button is pressed. */
  find: "shortcut-find",
  /** The macOS menu's Settings (and the way to Help): the home screen's settings button (no shortcut). */
  settings: "shortcut-settings",
  /** The home screen's button that opens the note-type menu (the menu bar's New Text Note, New List...). */
  noteTypes: "shortcut-note-types",
} as const;

/** An item of the note-type menu, by note type (`NOTE_TYPES`' keys). */
export const noteTypeTarget = (key: string) => `shortcut-new-${key}`;
