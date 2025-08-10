import Toast from "react-native-root-toast";

import { PADDING_MARGIN } from "@/constants/styles";

export const toast = (text) => {
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
