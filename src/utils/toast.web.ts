import { toast as hotToast } from "react-hot-toast";

export const toast = (text: string): void => {
  hotToast(text, {
    duration: 2000,
    position: "bottom-center",
    style: {
      borderRadius: "100px",
      padding: "12px 24px",
      backgroundColor: "#333",
      color: "#fff",
      fontFamily: "Roboto, sans-serif",
    },
  });
};
