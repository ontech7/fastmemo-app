import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpenIcon, CheckIcon, EyeSlashIcon, KeyIcon, StarIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { formatDateTime, reverseDate } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { webhook } from "@/utils/webhook";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, CARD_TYPE_COLOR, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import { getCategories } from "@/slicers/categoriesSlice";
import { restoreNote } from "@/slicers/notesSlice";
import { selectorWebhook_restoreNote } from "@/slicers/settingsSlice";
import CategoryIcon from "@/components/CategoryIcon";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";

import type { Note } from "@/types";

interface Props {
  content: Note;
  isSelected: boolean;
  selectNote: (id: string, locked: boolean) => void;
  isDeleteMode: boolean;
  toggleDeleteMode: () => void;
}

/** Color of the card's left border — the type signal (red kept for important). */
function getCardAccent(type: Note["type"], important: boolean): string {
  if (important) return COLOR.darkImportant;

  switch (type) {
    case "todo":
      return CARD_TYPE_COLOR.todo;
    case "kanban":
      return CARD_TYPE_COLOR.kanban;
    case "code":
      return CARD_TYPE_COLOR.code;
    default:
      return CARD_TYPE_COLOR.text;
  }
}

function TrashedNoteCard({ content, isSelected, selectNote, isDeleteMode, toggleDeleteMode }: Props) {
  const { t } = useTranslation();

  const { id, type, title, date, createdAt, updatedAt, category, important, readOnly, hidden, locked, deleteDate } = content;

  const dispatch = useDispatch();

  const webhook_restoreNote = useSelector(selectorWebhook_restoreNote);

  const categories = useSelector(getCategories);

  const [showRestoreNoteDialog, setShowRestoreNoteDialog] = useState(false);

  const onLongPressHandler = () => {
    if (!isDeleteMode) selectNote(id, locked);
    toggleDeleteMode();
  };

  const onPressHandler = () => {
    if (isDeleteMode) {
      selectNote(id, locked);
      return;
    }

    setShowRestoreNoteDialog(true);
  };

  const isImportant = !!important;
  const accent = getCardAccent(type, isImportant);
  const fg = isImportant ? COLOR.softWhite : COLOR.darkBlue;
  const chipBg = isImportant ? "rgba(255, 255, 255, 0.18)" : "rgba(2, 14, 53, 0.06)";
  const hasStatus = important || readOnly || locked || hidden;
  const TypeIcon = type && type !== "text" ? NOTE_TYPES.find((nt) => nt.key === type)?.icon : undefined;

  const updatedDate = formatDateTime(Number(updatedAt) || Number(new Date(reverseDate(date))));
  const createdDate = formatDateTime(Number(createdAt) || Number(new Date(reverseDate(date))));

  return (
    <>
      <ConfirmOrCancelDialog
        open={showRestoreNoteDialog}
        description={t("popup.restore_single_note")}
        onCancel={() => setShowRestoreNoteDialog(false)}
        onConfirm={() => {
          dispatch(restoreNote({ id, categories }));
          webhook(webhook_restoreNote, {
            action: "note/restore",
            id: id,
          });
          setShowRestoreNoteDialog(false);
        }}
      />

      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.container,
          isImportant ? styles.containerImportant : styles.containerDefault,
          isSelected && (isImportant ? styles.containerImportantSelected : styles.containerSelected),
          { borderLeftColor: accent },
          hidden && styles.hiddenContainer,
        ]}
        onPress={onPressHandler}
        onLongPress={onLongPressHandler}
      >
        {isDeleteMode ? (
          <View
            style={[
              styles.deleteCheckbox,
              isImportant && styles.deleteCheckboxImportant,
              isSelected && styles.deleteCheckboxSelected,
            ]}
          >
            {isSelected && <CheckIcon size={14} color={COLOR.softWhite} />}
          </View>
        ) : (
          !category.index && (
            <View style={[styles.avatar, { backgroundColor: chipBg }]}>
              <CategoryIcon name={category.icon} size={22} color={fg} />
            </View>
          )
        )}

        <View style={styles.main}>
          <View style={styles.titleRow}>
            {TypeIcon && (
              <View style={[styles.typeChip, { backgroundColor: chipBg }]}>
                <TypeIcon size={16} color={isImportant ? fg : accent} />
              </View>
            )}

            <Text style={[styles.title, { color: fg }]} numberOfLines={1} ellipsizeMode="tail">
              {isStringEmpty(title) ? t("empty_title") : title}
            </Text>

            {hasStatus && (
              <View style={styles.statusRow}>
                {important && <StarIcon size={14} color={fg} />}
                {locked && <KeyIcon size={14} color={fg} />}
                {readOnly && <BookOpenIcon size={14} color={fg} />}
                {hidden && <EyeSlashIcon size={14} color={fg} />}
              </View>
            )}
          </View>

          <View style={styles.meta}>
            <Text style={[styles.date, { color: fg }]} numberOfLines={1} ellipsizeMode="tail">
              {t("note.updated")}
              <Text style={styles.dateValue}>{updatedDate}</Text>
            </Text>

            <Text style={[styles.date, { color: fg }]} numberOfLines={1} ellipsizeMode="tail">
              {t("note.created")}
              <Text style={styles.dateValue}>{createdDate}</Text>
            </Text>
          </View>

          <CountdownDate deleteDate={deleteDate} fg={fg} chipBg={chipBg} />
        </View>
      </TouchableOpacity>
    </>
  );
}

interface CountdownDateProps {
  deleteDate: number | null;
  fg: string;
  chipBg: string;
}

function CountdownDate({ deleteDate, fg, chipBg }: CountdownDateProps) {
  const { t } = useTranslation();

  const now = new Date().getTime();

  const distance = (deleteDate ?? 0) - now;

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <View style={[styles.countdown, { backgroundColor: chipBg }]}>
      <Text style={[styles.countdownText, { color: fg }]}>{t("trashednotes.countdown", { days, hours, minutes })}</Text>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    padding: PADDING_MARGIN.lg - 2,
    marginBottom: PADDING_MARGIN.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    overflow: "hidden",
    borderLeftWidth: 5,
    ...SHADOW.card,
  },
  containerDefault: { backgroundColor: COLOR.softWhite },
  containerImportant: { backgroundColor: COLOR.important },
  containerSelected: { backgroundColor: COLOR.gray },
  containerImportantSelected: { backgroundColor: COLOR.darkImportant },
  hiddenContainer: { opacity: 0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChip: {
    width: 22,
    height: 22,
    borderRadius: BORDER.small,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1, minWidth: 0, gap: PADDING_MARGIN.xs },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  statusRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  deleteCheckbox: {
    alignSelf: "flex-start",
    backgroundColor: COLOR.lightBlue,
    borderRadius: BORDER.small,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteCheckboxImportant: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
  deleteCheckboxSelected: { backgroundColor: COLOR.accentMuted },
  title: {
    flex: 1,
    fontSize: FONTSIZE.cardTitle,
    fontFamily: FONT.bold,
    letterSpacing: -0.3,
  },
  meta: { gap: 2 },
  date: {
    fontSize: FONTSIZE.small,
    fontFamily: FONT.regular,
    opacity: 0.6,
  },
  dateValue: { fontFamily: FONT.semiBold },
  countdown: {
    alignSelf: "flex-start",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    marginTop: PADDING_MARGIN.xs,
  },
  countdownText: {
    fontSize: FONTSIZE.small,
    fontFamily: FONT.semiBold,
  },
});

export default memo(TrashedNoteCard);
