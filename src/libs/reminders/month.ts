/* The month of the reminder's date picker (spec D.5): pure. */

export interface MonthDay {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
}

const dayOf = (date: Date, inMonth: boolean): MonthDay => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
  inMonth,
});

/** The month as weeks of seven days starting on `weekStart` (0 Sunday, 1 Monday), completed with the neighbours' days. */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): MonthDay[][] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (first.getDay() - weekStart + 7) % 7;
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const grid: MonthDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: MonthDay[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - lead;
      week.push(dayOf(new Date(year, month - 1, 1 + offset), offset >= 0 && offset < daysInMonth));
    }
    grid.push(week);
  }
  return grid;
}
