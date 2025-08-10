import React from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { ArrowPathIcon, EllipsisVerticalIcon, TrashIcon } from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useDispatch, useSelector } from "react-redux";

import { popupAlert } from "@/utils/alert";
import { toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { getCategories } from "../../slicers/categoriesSlice";
import {
  deleteAllNotes,
  deleteSelectedNotes,
  restoreAllTrashedNotes,
  restoreSelectedTrashedNotes,
} from "../../slicers/notesSlice";
import { selectorWebhook_deleteNote, selectorWebhook_restoreNote } from "../../slicers/settingsSlice";
import ContextMenu from "../renderers/ContextMenu";

export default function TrashedNotesSettingsButton({
  selectedNotes,
  setSelectedNotes,
  isDeleteMode,
  setIsDeleteMode,
  isFingerprintEnabled,
}) {
  const { t } = useTranslation();

  const router = useRouter();

  const is_protected_note = selectedNotes.some((id) => id.split("|")[1] == "true");

  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_restoreNote = useSelector(selectorWebhook_restoreNote);

  const categories = useSelector(getCategories);

  const dispatch = useDispatch();

  const restoreSelectedNotesFromItems = () => {
    popupAlert(t("warning"), t("popup.restore_notes"), {
      confirmText: t("restore"),
      confirmHandler: () => {
        dispatch(restoreSelectedTrashedNotes({ categories, selectedNotes }));
        webhook(webhook_restoreNote, {
          action: "note/restoreNote",
          extra: "mutiple",
          ids: selectedNotes,
        });
        setSelectedNotes([]);
        setIsDeleteMode(false);
      },
    });
  };

  const deleteSelectedNotesFromItems = () => {
    const popupDeleteSelectedNotes = () =>
      popupAlert(t("warning"), t("popup.delete_notes_perma"), {
        confirmText: t("delete"),
        confirmHandler: () => {
          dispatch(deleteSelectedNotes({ selectedNotes }));
          webhook(webhook_deleteNote, {
            action: "note/deleteNote",
            extra: "mutiple",
            ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
          });
          setSelectedNotes([]);
          setIsDeleteMode(false);
        },
      });

    if (is_protected_note) {
      toggleWithSecret({
        router,
        isFingerprintEnabled,
        callback: popupDeleteSelectedNotes,
      });
    } else {
      popupDeleteSelectedNotes();
    }
  };

  const restoreAllNotesFromItems = () => {
    popupAlert(t("warning"), t("popup.restore_all_notes"), {
      confirmText: t("restore"),
      confirmHandler: () => {
        dispatch(restoreAllTrashedNotes({ categories }));
        webhook(webhook_restoreNote, {
          action: "note/restoreNote",
          extra: "all",
        });
        setIsDeleteMode(false);
      },
    });
  };

  const deleteAllNotesFromItems = () => {
    const popupDeleteAllNotes = () =>
      popupAlert(t("warning"), t("popup.delete_all_notes_perma"), {
        confirmText: t("delete"),
        confirmHandler: () => {
          dispatch(deleteAllNotes());
          webhook(webhook_deleteNote, {
            action: "note/deleteNote",
            extra: "all",
          });
          setIsDeleteMode(false);
        },
      });

    toggleWithSecret({
      router,
      isFingerprintEnabled,
      callback: popupDeleteAllNotes,
    });
  };

  return (
    <Menu renderer={ContextMenu}>
      <MenuTrigger customStyles={{ TriggerTouchableComponent: TouchableOpacity }}>
        <EllipsisVerticalIcon size={28} color={COLOR.softWhite} />
      </MenuTrigger>

      {!isDeleteMode ? (
        <MenuOptions customStyles={menuOptionsCustomStyles}>
          <MenuOption style={[styles.menuOption]} onSelect={deleteAllNotesFromItems}>
            <Text style={styles.menuOptionText}>{t("trashednotes.settings.delete_all")}</Text>

            <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>

          <MenuOption style={[styles.menuOption]} onSelect={restoreAllNotesFromItems}>
            <Text style={styles.menuOptionText}>{t("trashednotes.settings.restore_all")}</Text>

            <ArrowPathIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>
        </MenuOptions>
      ) : (
        <MenuOptions customStyles={menuOptionsCustomStyles}>
          <MenuOption style={[styles.menuOption]} onSelect={deleteSelectedNotesFromItems}>
            <Text style={styles.menuOptionText}>{t("trashednotes.settings.delete_selected")}</Text>

            <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>

          <MenuOption style={[styles.menuOption]} onSelect={restoreSelectedNotesFromItems}>
            <Text style={styles.menuOptionText}>{t("trashednotes.settings.restore_selected")}</Text>

            <ArrowPathIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>
        </MenuOptions>
      )}
    </Menu>
  );
}

/* STYLES */

const menuOptionsCustomStyles = {
  optionsContainer: {
    marginTop: 35,
    marginRight: 5,
    backgroundColor: COLOR.blue,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  optionsWrapper: {
    backgroundColor: COLOR.blue,
  },
};

const styles = StyleSheet.create({
  menuViewWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOption: {
    padding: PADDING_MARGIN.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOptionDisabled: { opacity: 0.5 },
  menuOptionIcon: { marginLeft: PADDING_MARGIN.lg },
  menuOptionText: { color: COLOR.softWhite, fontSize: 14 },
  menuOptionTextSelected: {
    fontWeight: FONTWEIGHT.semiBold,
  },
});
