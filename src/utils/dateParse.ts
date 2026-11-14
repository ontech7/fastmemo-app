/*
 * Parsing the `date` string notes carry ("<weekday> DD/MM/YYYY, HH:mm"). No dependencies: the sync code uses it too.
 */

export const reverseDate = (dateFormatted: string): string => {
  const [, date, , time] = dateFormatted.split(" ");
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}T${time}:00Z`;
};

export const getReversedDateTime = (dateFormatted: string): number => {
  return new Date(reverseDate(dateFormatted)).getTime();
};

/** Whole calendar days from `timestamp`'s day to `now`'s (0: the same day, 1: the day before), in local time. */
export const daysAgo = (timestamp: number, now: number = Date.now()): number => {
  const midnight = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((midnight(now) - midnight(timestamp)) / 86_400_000);
};
