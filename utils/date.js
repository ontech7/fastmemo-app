import * as Localization from "expo-localization";

import { supportedLanguages } from "@/libs/i18n";

import { capitalize } from "./string";

export const reverseDate = (dateFormatted) => {
  const [, date, , time] = dateFormatted.split(" ");

  const [day, month, year] = date.split("/");

  return `${year}-${month}-${day}T${time}:00Z`;
};

export const getReversedDateTime = (dateFormatted) => {
  return new Date(reverseDate(dateFormatted)).getTime();
};

export const formatDateTime = (timestamp = null) => {
  const date = new Date(timestamp || Date.now());

  const locale = Localization.getLocales()[0];

  let languageTag = "en-US";

  if (supportedLanguages[locale.languageCode]) {
    languageTag = locale.languageTag;
  }

  const formatter = new Intl.DateTimeFormat(languageTag, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return capitalize(formatter.format(date));
};
