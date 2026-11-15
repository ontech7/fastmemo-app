import { getCalendars } from "expo-localization";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import CalendarDaysIcon from "react-native-heroicons/outline/CalendarDaysIcon";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MonthGrid from "@/components/ui/MonthGrid";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { isUpcoming } from "@/libs/reminders/plan";
import { formatWhen, presets } from "@/libs/reminders/presets";

import type { Preset } from "@/libs/reminders/presets";

/** Mount it only while it is open: each opening starts on the quick choices, computed for that moment. */
interface Props {
  visible: boolean;
  remindAt?: number;
  onSet: (at: number) => void;
  onRemove: () => void;
  onClose: () => void;
  /** A line under the choices (the desktop's, or the phone's about being late; Task 39 sets the phone's). */
  note?: string;
}

interface Day {
  year: number;
  month: number;
  day: number;
}

const PRESET_LABEL: Record<Preset["key"], string> = {
  hour: "reminder.in_hour",
  tonight: "reminder.tonight",
  tomorrow: "reminder.tomorrow",
  monday: "reminder.monday",
};

const dayOf = (date: Date): Day => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
const two = (n: number) => String(n).padStart(2, "0");

/** The device calendar's first day of the week: Sunday (0) or Monday (1). */
const weekStartOfDevice = (): 0 | 1 => {
  try {
    return getCalendars()[0]?.firstWeekday === 1 ? 0 : 1;
  } catch {
    return 1;
  }
};

/** The custom choice starts on the current reminder, or today at the next full hour. */
const customStart = (remindAt: number | undefined, now: number) => {
  const start = new Date(remindAt && remindAt > now ? remindAt : now);
  if (!(remindAt && remindAt > now)) start.setHours(start.getHours() + 1, 0, 0, 0);
  return { day: dayOf(start), hours: two(start.getHours()), minutes: two(start.getMinutes()) };
};

/**
 * A note's reminder (spec D.5): four quick choices with their day and time, or a day from the month and a time. With a
 * reminder already on the note, it says when and offers to remove it first; a choice below replaces it.
 */
export default function ReminderSheet({ visible, remindAt, onSet, onRemove, onClose, note }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  // Edge to edge: the sheet's last row stays above the system's bar.
  const insets = useSafeAreaInsets();

  // Mounted for one opening (the menu mounts it while it's open): the moment, the choices and the custom start are this
  // opening's.
  const [now] = useState(() => Date.now());
  const [start] = useState(() => customStart(remindAt, now));
  const [weekStart] = useState(weekStartOfDevice);
  const [custom, setCustom] = useState(false);
  const [selected, setSelected] = useState<Day>(start.day);
  const [view, setView] = useState({ year: start.day.year, month: start.day.month });
  const [hours, setHours] = useState(start.hours);
  const [minutes, setMinutes] = useState(start.minutes);
  const [past, setPast] = useState(false);

  const choices = useMemo(() => presets(new Date(now)), [now]);
  const hasReminder = isUpcoming({ remindAt }, now);

  const setCustomTime = () => {
    const h = Math.min(23, Math.max(0, parseInt(hours, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minutes, 10) || 0));
    const at = new Date(selected.year, selected.month - 1, selected.day, h, m, 0, 0).getTime();
    if (at <= Date.now()) {
      setPast(true);
      return;
    }
    onSet(at);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("a11y.close")} />
      <KeyboardAvoidingView
        // The time's fields stay above the keyboard (Android too: the sheet's window doesn't resize).
        behavior="padding"
        style={styles.anchor}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: PADDING_MARGIN.xl + insets.bottom }]}>
          <View style={styles.handle} />

          {!custom ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {t("note.settings.reminder")}
              </Text>
              {hasReminder && (
                <>
                  <Text style={styles.current}>
                    {t("reminder.current", { when: formatWhen(remindAt as number, language) })}
                  </Text>
                  <Pressable style={[styles.action, styles.removeAction]} onPress={onRemove} accessibilityRole="button">
                    <Text style={styles.removeLabel}>{t("reminder.remove")}</Text>
                  </Pressable>
                </>
              )}

              {choices.map((choice) => (
                <Pressable
                  key={choice.key}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => onSet(choice.at)}
                  accessibilityRole="button"
                >
                  <Text style={styles.rowLabel}>{t(PRESET_LABEL[choice.key])}</Text>
                  <Text style={styles.rowValue}>{formatWhen(choice.at, language)}</Text>
                </Pressable>
              ))}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => setCustom(true)}
                accessibilityRole="button"
              >
                <Text style={styles.rowLabel}>{t("reminder.choose")}</Text>
                <View style={styles.rowIcons}>
                  <CalendarDaysIcon size={16} color={COLOR.textSecondary} />
                  <ChevronRightIcon size={14} color={COLOR.textMuted} />
                </View>
              </Pressable>

              {!!note && <Text style={styles.note}>{note}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {t("reminder.choose").replace(/…$/, "")}
              </Text>
              <MonthGrid
                year={view.year}
                month={view.month}
                selected={selected}
                min={dayOf(new Date(now))}
                weekStart={weekStart}
                onSelect={(day) => {
                  setSelected(day);
                  setPast(false);
                }}
                onMonth={(year, month) => setView({ year, month })}
              />

              <View style={styles.time}>
                <TextInput
                  style={styles.timeField}
                  value={hours}
                  onChangeText={(text) => {
                    setHours(text.replace(/\D/g, ""));
                    setPast(false);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel={`${t("reminder.choose")} (h)`}
                />
                <Text style={styles.timeColon}>:</Text>
                <TextInput
                  style={styles.timeField}
                  value={minutes}
                  onChangeText={(text) => {
                    setMinutes(text.replace(/\D/g, ""));
                    setPast(false);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel={`${t("reminder.choose")} (min)`}
                />
              </View>
              {past && (
                <Text style={styles.past} accessibilityLiveRegion="polite">
                  {t("reminder.past")}
                </Text>
              )}

              <View style={styles.footer}>
                <Pressable
                  style={[styles.action, styles.cancelAction]}
                  onPress={() => setCustom(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelLabel}>{t("cancel")}</Text>
                </Pressable>
                <Pressable style={[styles.action, styles.confirmAction]} onPress={setCustomTime} accessibilityRole="button">
                  <Text style={styles.confirmLabel}>{t("reminder.set")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: COLOR.scrim },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingTop: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.xl,
    backgroundColor: COLOR.surface,
    borderTopLeftRadius: BORDER.big,
    borderTopRightRadius: BORDER.big,
    borderWidth: 1,
    borderColor: GLASS.border,
    gap: PADDING_MARGIN.xs,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fillStrong,
    marginBottom: PADDING_MARGIN.md,
  },
  title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
    marginBottom: PADDING_MARGIN.xs,
  },
  current: { color: COLOR.accentSoft, fontFamily: FONT.medium, fontSize: FONTSIZE.small, marginBottom: PADDING_MARGIN.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  rowPressed: { backgroundColor: GLASS.fill },
  rowLabel: { flexShrink: 1, color: COLOR.textPrimary, fontFamily: FONT.medium, fontSize: FONTSIZE.paragraph },
  rowValue: { color: COLOR.textSecondary, fontFamily: FONT.regular, fontSize: FONTSIZE.small },
  rowIcons: { flexDirection: "row", alignItems: "center", gap: PADDING_MARGIN.xs },
  note: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    paddingHorizontal: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.xs,
  },
  time: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.md,
  },
  timeField: {
    width: 64,
    paddingVertical: PADDING_MARGIN.sm,
    textAlign: "center",
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
  },
  timeColon: { color: COLOR.textSecondary, fontFamily: FONT.semiBold, fontSize: FONTSIZE.subtitle },
  past: {
    color: COLOR.dangerSoft,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    textAlign: "center",
    marginTop: PADDING_MARGIN.xs,
  },
  footer: { flexDirection: "row", gap: PADDING_MARGIN.md, marginTop: PADDING_MARGIN.lg },
  action: {
    flex: 1,
    paddingVertical: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAction: { backgroundColor: GLASS.fill, borderWidth: 1, borderColor: GLASS.border },
  confirmAction: { backgroundColor: COLOR.accentMuted, borderWidth: 1, borderColor: COLOR.accentMutedBorder },
  // Alone in the column: not the footer row's flex, which collapses it to nothing on Android.
  removeAction: {
    flex: 0,
    marginTop: PADDING_MARGIN.xs,
    marginBottom: PADDING_MARGIN.md,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  cancelLabel: { color: COLOR.textSecondary, fontFamily: FONT.semiBold, fontSize: FONTSIZE.paragraph },
  confirmLabel: { color: COLOR.softWhite, fontFamily: FONT.semiBold, fontSize: FONTSIZE.paragraph },
  removeLabel: { color: COLOR.dangerSoft, fontFamily: FONT.semiBold, fontSize: FONTSIZE.paragraph },
});
