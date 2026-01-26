import { Platform } from "react-native";

import { PADDING_MARGIN } from "@/constants/styles";

export const toast = (text) => {
  if (Platform.OS === "web") {
    const hotToast = require("react-hot-toast").toast;
    hotToast(text, {
      duration: 2000,
      position: "bottom-center",
      style: {
        borderRadius: "100px",
        padding: "12px 24px",
        backgroundColor: "#333",
        color: "#fff",
      },
    });
    return;
  }

  const Toast = require("react-native-root-toast").default;
  Toast.show(text, {
    duration: Toast.durations.SHORT,
    position: Toast.positions.BOTTOM,
    opacity: 0.9,
    shadow: true,
    backgroundColor: "#333",
    containerStyle: {
      borderRadius: 100,
      paddingHorizontal: PADDING_MARGIN.lg,
    },
  });
};
