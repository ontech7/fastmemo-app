import i18n from "i18next";
import { Alert } from "react-native";

export const popupAlert = (title, text, confirm, alternate = {}) => {
  const { confirmText, confirmHandler } = confirm;

  const alternateText = "alternateText" in alternate ? alternate.alternateText : null;
  const alternateHandler = "alternateHandler" in alternate ? alternate.alternateHandler : null;

  if (Object.keys(alternate).length === 0) {
    Alert.alert(title, text, [
      {
        text: i18n.t("cancel"),
        style: "cancel",
      },
      {
        text: confirmText,
        onPress: confirmHandler,
      },
    ]);
  } else {
    Alert.alert(title, text, [
      {
        text: i18n.t("cancel"),
        style: "cancel",
      },
      {
        text: alternateText,
        onPress: alternateHandler,
      },
      {
        text: confirmText,
        onPress: confirmHandler,
      },
    ]);
  }
};
