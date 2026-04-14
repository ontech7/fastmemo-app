import { Platform } from "react-native";

interface LocaleInfo {
  languageCode: string;
  regionCode: string;
  languageTag: string;
}

export const getLocales = (): LocaleInfo[] => {
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

export const locale: string = (() => {
  const locales = getLocales();
  return locales[0]?.languageTag || "en-US";
})();

export const languageCode: string = (() => {
  const locales = getLocales();
  return locales[0]?.languageCode || "en";
})();
