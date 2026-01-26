import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpenIcon, CheckIcon, EyeSlashIcon, KeyIcon, StarIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { formatDateTime, reverseDate } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { getCategories } from "../../slicers/categoriesSlice";
import { restoreNote } from "../../slicers/notesSlice";
import { selectorWebhook_restoreNote } from "../../slicers/settingsSlice";
import CategoryIcon from "../CategoryIcon";
import ConfirmOrCancelDialog from "../dialogs/ConfirmOrCancelDialog";

function TrashedNoteCard({ content, isSelected, selectNote, isDeleteMode, toggleDeleteMode }) {
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

  const importantColor = important ? COLOR.softWhite : COLOR.darkBlue;

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
          type == "todo" && styles.containerTodo,
          type == "kanban" && styles.containerKanban,
          important && styles.importantContainer,
          isSelected && styles.selectedContainer,
          isSelected && type == "todo" && styles.selectedContainerTodo,
          isSelected && type == "kanban" && styles.selectedContainerKanban,
          important && isSelected && styles.selectedImportantContainer,
          hidden && styles.hiddenContainer,
          isDeleteMode && styles.containerDeleteMode,
        ]}
        onPress={onPressHandler}
        onLongPress={onLongPressHandler}
      >
        {hidden && (
          <EyeSlashIcon
            style={[styles.iconHidden, isDeleteMode && styles.iconTypeDeleteMode]}
            size={14}
            color={importantColor}
          />
        )}

        {!category.index && (
          <View style={styles.iconCategory}>
            <CategoryIcon name={category.icon} color={importantColor} />
          </View>
        )}

        <View style={{ width: !isDeleteMode ? "85%" : "82%" }}>
          {type && type !== "text" && (
            <View
              style={[
                styles.typeBadge,
                type === "todo" && styles.typeBadgeTodo,
                type === "kanban" && styles.typeBadgeKanban,
                isSelected && type === "todo" && styles.typeBadgeTodoSelected,
                isSelected && type === "kanban" && styles.typeBadgeKanbanSelected,
                important && styles.typeBadgeImportant,
              ]}
            >
              <Text style={[styles.typeBadgeText, important && styles.typeBadgeTextImportant]}>{t(`note.type.${type}`)}</Text>
            </View>
          )}
          <Text style={[styles.title, important && styles.titleImportant]} numberOfLines={1} ellipsizeMode="tail">
            {isStringEmpty(title) ? t("empty_title") : title}
          </Text>

          <Text style={[styles.date, important && styles.dateImportant]} numberOfLines={1} ellipsizeMode="tail">
            {t("note.updated")}
            <Text style={{ fontWeight: "600" }}>{formatDateTime(updatedAt || reverseDate(date))}</Text>
          </Text>

          <Text style={[styles.date, important && styles.dateImportant]} numberOfLines={1} ellipsizeMode="tail">
            {t("note.created")}
            <Text style={{ fontWeight: "600" }}>{formatDateTime(createdAt || reverseDate(date))}</Text>
          </Text>

          <CountdownDate deleteDate={deleteDate} important={important} />
        </View>

        {important && (
          <StarIcon style={[styles.iconFavorite, isDeleteMode && styles.iconDeleteMode]} size={14} color={COLOR.softWhite} />
        )}

        {readOnly && (
          <BookOpenIcon style={[styles.iconReadOnly, isDeleteMode && styles.iconDeleteMode]} size={14} color={importantColor} />
        )}

        {locked && (
          <KeyIcon style={[styles.iconLocked, isDeleteMode && styles.iconDeleteMode]} size={14} color={importantColor} />
        )}

        {!important && isDeleteMode && (
          <View style={[styles.deleteMode, isSelected && styles.deleteModeSelected]}>
            {isSelected && <CheckIcon size={14} color={COLOR.lightBlue} />}
          </View>
        )}

        {important && isDeleteMode && (
          <View style={[styles.deleteModeImportant, important && styles.deleteModeImportantSelected]}>
            {isSelected && <CheckIcon size={14} color={COLOR.darkBlue} />}
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

function CountdownDate({ deleteDate, important }) {
  const { t } = useTranslation();

  const now = new Date().getTime();

  var distance = deleteDate - now;

  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <Text style={[styles.deleteDate, important && styles.deleteDateImportant]}>
      {t("trashednotes.countdown", { days, hours, minutes })}
    </Text>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    padding: PADDING_MARGIN.md + 2,
    paddingRight: PADDING_MARGIN.xxl,
    marginBottom: PADDING_MARGIN.lg,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.softWhite,
  },
  containerDeleteMode: {
    paddingRight: PADDING_MARGIN.xxl + 30,
  },
  containerTodo: {
    backgroundColor: COLOR.yellow,
  },
  containerKanban: {
    backgroundColor: COLOR.oceanBreeze,
  },
  selectedContainer: {
    backgroundColor: COLOR.lightBlue,
    opacity: 0.8,
  },
  selectedContainerTodo: {
    backgroundColor: COLOR.darkYellow,
    opacity: 0.8,
  },
  selectedContainerKanban: {
    backgroundColor: COLOR.darkOceanBreeze,
    opacity: 0.8,
  },
  deleteMode: {
    position: "absolute",
    top: 13,
    right: 10,
    backgroundColor: COLOR.lightBlue,
    borderRadius: BORDER.rounded,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModeImportant: {
    position: "absolute",
    top: 13,
    right: 10,
    backgroundColor: COLOR.gray,
    borderRadius: BORDER.rounded,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModeSelected: { backgroundColor: COLOR.blue },
  deleteModeImportantSelected: { backgroundColor: COLOR.softWhite },
  importantContainer: { backgroundColor: COLOR.important },
  selectedImportantContainer: { backgroundColor: COLOR.darkImportant },
  hiddenContainer: { opacity: 0.5 },
  iconDeleteMode: { right: 40 },
  iconTypeDeleteMode: { right: 60 },
  iconCategory: { marginRight: PADDING_MARGIN.md },
  iconFavorite: { position: "absolute", top: 10, right: 10 },
  iconLocked: { position: "absolute", top: 27, right: 10 },
  iconReadOnly: { position: "absolute", top: 44, right: 10 },
  iconHidden: { position: "absolute", top: 61, right: 10 },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.small,
    marginBottom: PADDING_MARGIN.sm,
  },
  typeBadgeTodo: {
    backgroundColor: COLOR.darkYellow,
  },
  typeBadgeTodoSelected: {
    backgroundColor: COLOR.yellow,
  },
  typeBadgeKanban: {
    backgroundColor: COLOR.darkOceanBreeze,
  },
  typeBadgeKanbanSelected: {
    backgroundColor: COLOR.oceanBreeze,
  },
  typeBadgeImportant: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.darkBlue,
    textTransform: "uppercase",
  },
  typeBadgeTextImportant: {
    color: COLOR.softWhite,
  },
  title: {
    fontSize: FONTSIZE.cardTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.darkBlue,
    marginTop: -4,
    marginBottom: 2,
  },
  titleImportant: { color: COLOR.softWhite },
  date: {
    fontSize: FONTSIZE.small,
    color: COLOR.darkBlue,
    opacity: 0.6,
  },
  dateImportant: { color: COLOR.softWhite },
  deleteDate: {
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.semiBold,
    opacity: 0.8,
    marginTop: PADDING_MARGIN.xs,
  },
  deleteDateImportant: { color: COLOR.softWhite },
});

export default memo(TrashedNoteCard);
