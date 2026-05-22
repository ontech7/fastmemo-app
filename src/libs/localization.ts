import { getLocales as getExpoLocales } from "expo-localization";

interface LocaleInfo {
  languageCode: string;
  regionCode: string;
  languageTag: string;
}

export const getLocales = (): LocaleInfo[] => {
  return getExpoLocales().map((l) => ({
    languageCode: l.languageCode ?? "en",
    regionCode: l.regionCode ?? "",
    languageTag: l.languageTag ?? "en-US",
  }));
};

export const locale: string = (() => {
  const locales = getLocales();
  return locales[0]?.languageTag || "en-US";
})();

export const languageCode: string = (() => {
  const locales = getLocales();
  return locales[0]?.languageCode || "en";
})();
