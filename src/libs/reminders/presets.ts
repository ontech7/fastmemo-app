/*
 * The quick choices of a reminder (spec D.5), in local time: in an hour, tonight, tomorrow morning, next Monday.
 */

export interface Preset {
  key: "hour" | "tonight" | "tomorrow" | "monday";
  at: number;
}

const HOUR = 3_600_000;

const atLocal = (from: Date, addDays: number, hour: number) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + addDays, hour, 0, 0, 0).getTime();

export function presets(now: Date): Preset[] {
  const list: Preset[] = [];
  const inAnHour = new Date(now.getTime() + HOUR);
  inAnHour.setSeconds(0, 0);
  list.push({ key: "hour", at: inAnHour.getTime() });
  if (now.getHours() < 19) list.push({ key: "tonight", at: atLocal(now, 0, 20) });
  list.push({ key: "tomorrow", at: atLocal(now, 1, 9) });
  // The first Monday after today; none when tomorrow is Monday (it is "tomorrow").
  const daysToMonday = (1 - now.getDay() + 7) % 7 || 7;
  if (daysToMonday !== 1) list.push({ key: "monday", at: atLocal(now, daysToMonday, 9) });
  return list;
}

/**
 * A quick choice as it is when it is pressed (`now`), not when the sheet opened: a sheet left open across 19:00 has no
 * "tonight" any more (null), and "in an hour" is an hour from the press.
 */
export function choiceNow(key: Preset["key"], now: Date): number | null {
  const choice = presets(now).find((preset) => preset.key === key);
  return choice && choice.at > now.getTime() ? choice.at : null;
}

const formatters = new Map<string, { weekday: Intl.DateTimeFormat; date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();

const formattersFor = (language: string) => {
  let found = formatters.get(language);
  if (!found) {
    found = {
      weekday: new Intl.DateTimeFormat(language, { weekday: "short" }),
      date: new Intl.DateTimeFormat(language, { day: "numeric", month: "numeric" }),
      time: new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }),
    };
    formatters.set(language, found);
  }
  return found;
};

/** "Thu 12/11, 9:00" in the app's language. */
export function formatWhen(at: number, language: string): string {
  const { weekday, date, time } = formattersFor(language);
  const when = new Date(at);
  return `${weekday.format(when)} ${date.format(when)}, ${time.format(when)}`;
}
