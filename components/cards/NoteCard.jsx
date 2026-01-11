import { memo } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpenIcon, CheckIcon, EyeSlashIcon, KeyIcon, ListBulletIcon, StarIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import { formatDateTime, reverseDate } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { selectorIsFingerprintEnabled } from "../../slicers/settingsSlice";
import CategoryIcon from "../CategoryIcon";

function NoteCard({ content, isSelected, selectNote, isDeleteMode, toggleDeleteMode }) {
  const { t } = useTranslation();

  const router = useRouter();

  const { id, type, title, date, createdAt, updatedAt, category, important, readOnly, hidden, locked } = content;

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);
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

    if (!selectorFingerprintEnabled) {
      router.push({
        pathname: "/secret-code",
        params: {
          startPhase: "unlockCode",
          noteId: id,
        },
      });
      return;
    }

    LocalAuthentication.authenticateAsync().then((authResult) => {
      if (authResult?.success) {
        router.push(`/notes/${id}`);
      }
    });
  };

  const importantColor = important ? COLOR.softWhite : COLOR.darkBlue;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.container,
        type == "todo" && styles.containerTodo,
        important && styles.importantContainer,
        isSelected && styles.selectedContainer,
        isSelected && type == "todo" && styles.selectedContainerTodo,
        important && isSelected && styles.selectedImportantContainer,
        hidden && styles.hiddenContainer,
        isDeleteMode && styles.containerDeleteMode,
      ]}
      onPress={onPressHandler}
      onLongPress={onLongPressHandler}
    >
      {type == "todo" && (
        <ListBulletIcon
          style={[styles.iconTodoList, isDeleteMode && styles.iconTypeDeleteMode]}
          size={14}
          color={importantColor}
        />
      )}

      {hidden && (
        <EyeSlashIcon style={[styles.iconHidden, isDeleteMode && styles.iconTypeDeleteMode]} size={14} color={importantColor} />
      )}

      {!category.index && (
        <View style={styles.iconCategory}>
          <CategoryIcon name={category.icon} color={importantColor} />
        </View>
      )}

      <View style={{ width: !isDeleteMode ? "85%" : "82%" }}>
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
        <View style={[styles.deleteModeImportant, isSelected && styles.deleteModeImportantSelected]}>
          {isSelected && <CheckIcon size={14} color={COLOR.darkBlue} />}
        </View>
      )}
    </TouchableOpacity>
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
  selectedContainer: {
    backgroundColor: COLOR.lightBlue,
  },
  selectedContainerTodo: {
    backgroundColor: COLOR.darkYellow,
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
  iconTodoList: { position: "absolute", top: 10, right: 30 },
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
});

export default memo(NoteCard);
