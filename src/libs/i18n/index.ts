import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./locales/de";
import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";
import it from "./locales/it";
import ja from "./locales/ja";
import zh from "./locales/zh";

export const supportedLanguages = {
  de: {
    tag: "de-DE",
    code: "de",
    name: "Deutsch",
  },
  en: {
    tag: "en-US",
    code: "en",
    name: "English",
  },
  es: {
    tag: "es-ES",
    code: "es",
    name: "Español",
  },
  fr: {
    tag: "fr-FR",
    code: "fr",
    name: "Français",
  },
  it: {
    tag: "it-IT",
    code: "it",
    name: "Italiano",
  },
  ja: {
    tag: "ja-JP",
    code: "ja",
    name: "日本語",
  },
  zh: {
    tag: "zh-CH",
    code: "zh",
    name: "中文",
  },
};

i18n.use(initReactI18next).init({
  lng: Localization.getLocales()[0].languageCode || "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    it: { translation: it },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    ja: { translation: ja },
    zh: { translation: zh },
  },
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
