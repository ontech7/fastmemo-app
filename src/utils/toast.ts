import Toast from "react-native-root-toast";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

/** Below a screen's header: its 42 px chips and their padding, under the status bar. */
const UNDER_HEADER = 64;

/**
 * Toasts in the app's look (spec 5.4): glass fill, hairline border, fully rounded, Geist, a soft shadow, no icon. `top` for
 * one shown while the keyboard comes up (a new note): the library doesn't follow Android's keyboard, which would cover it.
 */
export const toast = (text: string, at: "bottom" | "top" = "bottom"): void => {
  Toast.show(text, {
    duration: Toast.durations.SHORT,
    position: at === "top" ? (initialWindowMetrics?.insets.top ?? 0) + UNDER_HEADER : Toast.positions.BOTTOM,
    // The fill carries its own alpha.
    opacity: 1,
    shadow: false,
    backgroundColor: GLASS.toastFill,
    textColor: COLOR.textPrimary,
    textStyle: {
      fontFamily: FONT.medium,
      fontSize: FONTSIZE.toast,
    },
    containerStyle: {
      borderRadius: BORDER.rounded,
      borderWidth: 1,
      borderColor: GLASS.border,
      paddingVertical: PADDING_MARGIN.sm,
      paddingHorizontal: PADDING_MARGIN.lg,
      boxShadow: "0px 6px 16px rgba(0,0,0,0.35)",
    },
  });
};
