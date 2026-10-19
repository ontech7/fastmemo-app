import * as Localization from "expo-localization";

import { supportedLanguages } from "@/libs/i18n";

import { capitalize } from "./string";

export const reverseDate = (dateFormatted: string): string => {
  const [, date, , time] = dateFormatted.split(" ");
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}T${time}:00Z`;
};

export const getReversedDateTime = (dateFormatted: string): number => {
  return new Date(reverseDate(dateFormatted)).getTime();
};

// Building an Intl.DateTimeFormat is expensive on Hermes, and every note card formats a date.
// Keyed by time zone too: the formatter captures the zone it was built in.
let dateTimeFormat: { key: string; formatter: Intl.DateTimeFormat } | null = null;

export const formatDateTime = (timestamp: number | null = null): string => {
  const date = new Date(timestamp || Date.now());

  const locale = Localization.getLocales()[0];

  let languageTag = "en-US";

  if (locale.languageCode && supportedLanguages[locale.languageCode]) {
    languageTag = locale.languageTag;
  }

  const key = `${languageTag}|${date.getTimezoneOffset()}`;

  if (dateTimeFormat?.key !== key) {
    dateTimeFormat = {
      key,
      formatter: new Intl.DateTimeFormat(languageTag, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
  }

  return capitalize(dateTimeFormat.formatter.format(date));
};
