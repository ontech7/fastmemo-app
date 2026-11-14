import type { TFunction } from "i18next";

import { daysAgo, formatDay } from "@/utils/date";

/** The day a version was kept, as the history writes it: "Today", "Yesterday", else the date. */
export const versionDay = (at: number, t: TFunction): string => {
  const days = daysAgo(at);
  return days === 0 ? t("history.today") : days === 1 ? t("history.yesterday") : formatDay(at);
};
