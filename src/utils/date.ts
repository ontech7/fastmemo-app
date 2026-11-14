import * as Localization from "expo-localization";

import { supportedLanguages } from "@/libs/i18n";

import { capitalize } from "./string";

export { daysAgo, getReversedDateTime, reverseDate } from "./dateParse";

// Building an Intl.DateTimeFormat is expensive on Hermes, and every note card formats a date.
// Keyed by time zone too: the formatter captures the zone it was built in.
let dateTimeFormat: { key: string; formatter: Intl.DateTimeFormat } | null = null;

/** The device's language when the app speaks it, else American English. */
const appLanguageTag = (): string => {
  const locale = Localization.getLocales()[0];
  return locale.languageCode && supportedLanguages[locale.languageCode] ? locale.languageTag : "en-US";
};

export const formatDateTime = (timestamp: number | null = null): string => {
  const date = new Date(timestamp || Date.now());
  const languageTag = appLanguageTag();
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

const partFormats = new Map<string, Intl.DateTimeFormat>();
const PART_OPTIONS: Record<"day" | "time", Intl.DateTimeFormatOptions> = {
  day: { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" },
  time: { hour: "2-digit", minute: "2-digit", hour12: false },
};

const formatPart = (part: "day" | "time", timestamp: number): string => {
  const date = new Date(timestamp);
  const languageTag = appLanguageTag();
  const key = `${part}|${languageTag}|${date.getTimezoneOffset()}`;
  let formatter = partFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(languageTag, PART_OPTIONS[part]);
    partFormats.set(key, formatter);
  }
  return capitalize(formatter.format(date));
};

/** A timestamp's day, written as `formatDateTime` writes it. */
export const formatDay = (timestamp: number): string => formatPart("day", timestamp);

/** A timestamp's hours and minutes. */
export const formatTime = (timestamp: number): string => formatPart("time", timestamp);
