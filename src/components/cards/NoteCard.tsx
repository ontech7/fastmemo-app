import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpenIcon, CheckIcon, EyeSlashIcon, KeyIcon, SignalSlashIcon, StarIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import { formatDateTime, reverseDate } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, CARD_TYPE_COLOR, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import CategoryIcon from "@/components/CategoryIcon";
import { useSecret } from "@/hooks/useSecret";
import { getNoteFilters } from "@/slicers/notesSlice";

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

function NoteCard({ content, isSelected, selectNote, isDeleteMode, toggleDeleteMode }: Props) {
  const { t } = useTranslation();

  const router = useRouter();
  const { unlockWithSecret } = useSecret();

  const { sortBy } = useSelector(getNoteFilters);

  const { id, type, title, date, createdAt, updatedAt, category, important, readOnly, hidden, locked, local } = content;

  const onLongPressHandler = () => {
    if (!isDeleteMode) {
      selectNote(id, locked);
    }

    toggleDeleteMode();
  };

  const onPressHandler = () => {
    if (isDeleteMode) {
      selectNote(id, locked);
      return;
    }

    if (!locked) {
      router.push(`/notes/${id}`);
      return;
    }

    unlockWithSecret((router, isFingerprint) => {
      if (isFingerprint) {
        router.push(`/notes/${id}`);
      } else {
        router.replace(`/notes/${id}`);
      }
    }, "none");
  };

  const isImportant = !!important;
  const accent = getCardAccent(type, isImportant);
  const fg = isImportant ? COLOR.softWhite : COLOR.darkBlue;
  const chipBg = isImportant ? "rgba(255, 255, 255, 0.18)" : "rgba(2, 14, 53, 0.09)";
  const hasStatus = important || readOnly || locked || hidden || local;
  const TypeIcon = type && type !== "text" ? NOTE_TYPES.find((nt) => nt.key === type)?.icon : undefined;

  const sortByUpdated = sortBy === "updatedAt";
  const metaLabel = sortByUpdated ? t("note.updated") : t("note.created");
  const metaTimestamp = sortByUpdated
    ? Number(updatedAt) || Number(new Date(reverseDate(date)))
    : Number(createdAt) || Number(new Date(reverseDate(date)));
  const metaDate = formatDateTime(metaTimestamp);

  return (
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
              {local && <SignalSlashIcon size={14} color={fg} />}
            </View>
          )}
        </View>

        <Text style={[styles.date, { color: fg }]} numberOfLines={1} ellipsizeMode="tail">
          {metaLabel}
          <Text style={styles.dateValue}>{metaDate}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    padding: PADDING_MARGIN.lg - 2,
    marginBottom: PADDING_MARGIN.md,
    flexDirection: "row",
    alignItems: "center",
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
    marginTop: -2, // optical nudge to align the first line with the top-left checkbox
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
  date: {
    fontSize: FONTSIZE.small,
    fontFamily: FONT.regular,
    opacity: 0.6,
  },
  dateValue: { fontFamily: FONT.semiBold },
});

export default memo(NoteCard);
