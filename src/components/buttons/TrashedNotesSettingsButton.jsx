import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { ArrowPathIcon, EllipsisVerticalIcon, TrashIcon } from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { getCategories } from "../../slicers/categoriesSlice";
import {
  deleteAllNotes,
  deleteSelectedNotes,
  restoreAllTrashedNotes,
  restoreSelectedTrashedNotes,
} from "../../slicers/notesSlice";
import { selectorWebhook_deleteNote, selectorWebhook_restoreNote } from "../../slicers/settingsSlice";
import ConfirmOrCancelDialog from "../dialogs/ConfirmOrCancelDialog";
import ContextMenu from "../renderers/ContextMenu";

export default function TrashedNotesSettingsButton({
  selectedNotes,
  setSelectedNotes,
  isDeleteMode,
  setIsDeleteMode,
  isFingerprintEnabled,
}) {
  const { t } = useTranslation();

  const { unlockWithSecret } = useSecret();

  const isNoteProtected = selectedNotes.some((id) => id.split("|")[1] == "true");

  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_restoreNote = useSelector(selectorWebhook_restoreNote);

  const categories = useSelector(getCategories);

  const dispatch = useDispatch();

  const [showRestoreSelectedNotesDialog, setShowRestoreSelectedNotesDialog] = useState(false);
  const [showDeleteSelectedNotesDialog, setShowDeleteSelectedNotesDialog] = useState(false);
  const [showRestoreAllNotesDialog, setShowRestoreAllNotesDialog] = useState(false);
  const [showDeleteAllNotesDialog, setShowDeleteAllNotesDialog] = useState(false);

  return (
    <>
      <ConfirmOrCancelDialog
        open={showRestoreSelectedNotesDialog}
        description={t("popup.restore_notes")}
        onCancel={() => setShowRestoreSelectedNotesDialog(false)}
        onConfirm={() => {
          dispatch(restoreSelectedTrashedNotes({ categories, selectedNotes }));
          webhook(webhook_restoreNote, {
            action: "note/restoreNote",
            extra: "mutiple",
            ids: selectedNotes,
          });
          setSelectedNotes([]);
          setIsDeleteMode(false);
          setShowRestoreSelectedNotesDialog(false);
        }}
        confirmLabel={t("restore")}
      />

      <ConfirmOrCancelDialog
        open={showDeleteSelectedNotesDialog}
        description={t("popup.delete_notes_perma")}
        onCancel={() => setShowDeleteSelectedNotesDialog(false)}
        onConfirm={() => {
          dispatch(deleteSelectedNotes({ selectedNotes }));
          webhook(webhook_deleteNote, {
            action: "note/deleteNote",
            extra: "mutiple",
            ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
          });
          setSelectedNotes([]);
          setIsDeleteMode(false);
          setShowDeleteSelectedNotesDialog(false);
        }}
        confirmLabel={t("delete")}
      />

      <ConfirmOrCancelDialog
        open={showRestoreAllNotesDialog}
        description={t("popup.restore_all_notes")}
        onCancel={() => setShowRestoreAllNotesDialog(false)}
        onConfirm={() => {
          dispatch(restoreAllTrashedNotes({ categories }));
          webhook(webhook_restoreNote, {
            action: "note/restoreNote",
            extra: "all",
          });
          setIsDeleteMode(false);
          setShowRestoreAllNotesDialog(false);
        }}
        confirmLabel={t("restore")}
      />

      <ConfirmOrCancelDialog
        open={showDeleteAllNotesDialog}
        description={t("popup.delete_all_notes_perma")}
        onCancel={() => setShowDeleteAllNotesDialog(false)}
        onConfirm={() => {
          dispatch(deleteAllNotes());
          webhook(webhook_deleteNote, {
            action: "note/deleteNote",
            extra: "all",
          });
          setIsDeleteMode(false);
          setShowDeleteAllNotesDialog(false);
        }}
        confirmLabel={t("delete")}
      />

      <Menu renderer={ContextMenu}>
        <MenuTrigger customStyles={{ TriggerTouchableComponent: TouchableOpacity }}>
          <EllipsisVerticalIcon size={28} color={COLOR.softWhite} />
        </MenuTrigger>

        {!isDeleteMode ? (
          <MenuOptions customStyles={menuOptionsCustomStyles}>
            <MenuOption style={[styles.menuOption]} onSelect={() => unlockWithSecret(() => setShowDeleteAllNotesDialog(true))}>
              <Text style={styles.menuOptionText}>{t("trashednotes.settings.delete_all")}</Text>

              <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
            </MenuOption>

            <MenuOption style={[styles.menuOption]} onSelect={() => setShowRestoreAllNotesDialog(true)}>
              <Text style={styles.menuOptionText}>{t("trashednotes.settings.restore_all")}</Text>

              <ArrowPathIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
            </MenuOption>
          </MenuOptions>
        ) : (
          <MenuOptions customStyles={menuOptionsCustomStyles}>
            <MenuOption
              style={[styles.menuOption]}
              onSelect={() => {
                if (isNoteProtected) {
                  unlockWithSecret(() => setShowDeleteSelectedNotesDialog(true));
                } else {
                  setShowDeleteSelectedNotesDialog(true);
                }
              }}
            >
              <Text style={styles.menuOptionText}>{t("trashednotes.settings.delete_selected")}</Text>

              <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
            </MenuOption>

            <MenuOption style={[styles.menuOption]} onSelect={() => setShowRestoreSelectedNotesDialog(true)}>
              <Text style={styles.menuOptionText}>{t("trashednotes.settings.restore_selected")}</Text>

              <ArrowPathIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
            </MenuOption>
          </MenuOptions>
        )}
      </Menu>
    </>
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
