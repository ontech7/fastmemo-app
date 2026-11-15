import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ChevronLeftIcon from "react-native-heroicons/outline/ChevronLeftIcon";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { monthGrid } from "@/libs/reminders/month";
import { capitalize } from "@/utils/string";

interface Day {
  year: number;
  month: number;
  day: number;
}

interface Props {
  year: number;
  month: number;
  selected?: Day;
  /** Days before this one can't be chosen. */
  min: Day;
  weekStart: 0 | 1;
  onSelect: (day: Day) => void;
  onMonth: (year: number, month: number) => void;
}

const key = (d: Day) => d.year * 10000 + d.month * 100 + d.day;

/**
 * A month to choose a day in (the reminder's sheet, spec D.5): arrows for the month before and after, the week starting
 * as the device's calendar does, days before `min` dimmed and not pressable. Each day is read with its whole date.
 */
export default function MonthGrid({ year, month, selected, min, weekStart, onSelect, onMonth }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const weeks = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const { title, weekdays, fullDate } = useMemo(() => {
    const monthTitle = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" });
    const narrow = new Intl.DateTimeFormat(language, { weekday: "narrow" });
    const full = new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return {
      title: capitalize(monthTitle.format(new Date(year, month - 1, 1))),
      // 4 January 1970 was a Sunday.
      weekdays: Array.from({ length: 7 }, (_, i) => narrow.format(new Date(1970, 0, 4 + weekStart + i))),
      fullDate: (d: Day) => full.format(new Date(d.year, d.month - 1, d.day)),
    };
  }, [language, year, month, weekStart]);

  const minKey = key(min);
  const selectedKey = selected ? key(selected) : -1;
  const canGoBack = year * 100 + month > min.year * 100 + min.month;

  const shift = (by: number) => {
    const next = new Date(year, month - 1 + by, 1);
    onMonth(next.getFullYear(), next.getMonth() + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={[styles.arrow, !canGoBack && styles.dim]}
          onPress={() => shift(-1)}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.prev_month")}
          aria-disabled={!canGoBack}
        >
          <ChevronLeftIcon size={18} color={COLOR.textPrimary} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          style={styles.arrow}
          onPress={() => shift(1)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.next_month")}
        >
          <ChevronRightIcon size={18} color={COLOR.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.row} aria-hidden focusable={false}>
        {weekdays.map((name, i) => (
          <Text key={i} style={[styles.cell, styles.weekday]}>
            {name}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((d) => {
            const k = key(d);
            const past = k < minKey;
            const pressable = d.inMonth && !past;
            const isSelected = d.inMonth && k === selectedKey;
            const isToday = k === minKey;
            return (
              <Pressable
                key={k}
                style={[styles.cell, styles.day, isToday && styles.today, isSelected && styles.selected]}
                onPress={() => onSelect({ year: d.year, month: d.month, day: d.day })}
                disabled={!pressable}
                accessibilityRole="radio"
                accessibilityLabel={fullDate(d)}
                aria-checked={isSelected}
                aria-disabled={!pressable}
                aria-hidden={!d.inMonth}
                focusable={d.inMonth}
              >
                <Text style={[styles.dayText, (!d.inMonth || past) && styles.dayTextDim, isSelected && styles.dayTextSelected]}>
                  {d.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: PADDING_MARGIN.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: PADDING_MARGIN.xs,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  dim: { opacity: 0.35 },
  title: {
    flex: 1,
    textAlign: "center",
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  row: { flexDirection: "row" },
  cell: { flex: 1, textAlign: "center" },
  weekday: {
    color: COLOR.textMuted,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    paddingVertical: PADDING_MARGIN.xs,
  },
  day: {
    height: 38,
    margin: 1,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  today: { borderWidth: 1, borderColor: COLOR.accentMutedBorder },
  selected: { backgroundColor: COLOR.accentMuted },
  dayText: { color: COLOR.textPrimary, fontFamily: FONT.medium, fontSize: FONTSIZE.paragraph },
  dayTextDim: { color: COLOR.textMuted, opacity: 0.6 },
  dayTextSelected: { color: COLOR.softWhite, fontFamily: FONT.semiBold },
});
