import { Platform } from "react-native";

export const getLocales = () => {
  if (Platform.OS === "web") {
    const languages = navigator.languages || [navigator.language || "en-US"];
    return languages.map((tag) => {
      const [languageCode, regionCode] = tag.split("-");
      return {
        languageCode,
        regionCode: regionCode || "",
        languageTag: tag,
      };
    });
  }

  return require("expo-localization").getLocales();
};

export const locale = (() => {
  const locales = getLocales();
  return locales[0]?.languageTag || "en-US";
})();

export const languageCode = (() => {
  const locales = getLocales();
  return locales[0]?.languageCode || "en";
})();
