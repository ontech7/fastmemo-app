import { toast as hotToast } from "react-hot-toast";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

/** Toasts in the app's look (spec 5.4): glass fill, hairline border, fully rounded, Geist, a soft shadow, no icon. */
export const toast = (text: string): void => {
  hotToast(text, {
    duration: 2000,
    position: "bottom-center",
    style: {
      borderRadius: `${BORDER.rounded}px`,
      padding: `${PADDING_MARGIN.sm}px ${PADDING_MARGIN.lg}px`,
      backgroundColor: GLASS.toastFill,
      border: `1px solid ${GLASS.border}`,
      boxShadow: "0px 6px 16px rgba(0,0,0,0.35)",
      color: COLOR.textPrimary,
      fontFamily: FONT.medium,
      fontSize: `${FONTSIZE.toast}px`,
    },
  });
};
