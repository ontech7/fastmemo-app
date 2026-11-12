import Toast from "react-native-root-toast";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

/** Toasts in the app's look (spec 5.4): glass fill, hairline border, fully rounded, Geist, a soft shadow, no icon. */
export const toast = (text: string): void => {
  Toast.show(text, {
    duration: Toast.durations.SHORT,
    position: Toast.positions.BOTTOM,
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
