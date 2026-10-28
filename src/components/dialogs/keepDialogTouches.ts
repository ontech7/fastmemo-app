import type { ViewProps } from "react-native";

/**
 * Spread onto `<Dialog>`: the library's backdrop touchable wraps the dialog too, so a tap on its text would close it. The
 * dialog keeps its own taps: on native it claims the touch, on the web it stops the click before it bubbles to the backdrop
 * (the responder doesn't stop a DOM click).
 */
export const KEEP_DIALOG_TOUCHES = {
  onStartShouldSetResponder: () => true,
  onClick: (event: { stopPropagation(): void }) => event.stopPropagation(),
} as ViewProps;
