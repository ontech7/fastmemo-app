import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowPathIcon, EllipsisVerticalIcon, TrashIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";

import { COLOR } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { getCategories } from "@/slicers/categoriesSlice";
import { deleteAllNotes, deleteSelectedNotes, restoreAllTrashedNotes, restoreSelectedTrashedNotes } from "@/slicers/notesSlice";
import { selectorWebhook_deleteNote, selectorWebhook_restoreNote } from "@/slicers/settingsSlice";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import IconChip from "@/components/ui/IconChip";
import PopupMenu, { PopupMenuOption } from "@/components/ui/PopupMenu";

interface Props {
  selectedNotes: string[];
  setSelectedNotes: (notes: string[]) => void;
  isDeleteMode: boolean;
  setIsDeleteMode: (mode: boolean) => void;
  isFingerprintEnabled: boolean;
}

export default function TrashedNotesSettingsButton({
  selectedNotes,
  setSelectedNotes,
  isDeleteMode,
  setIsDeleteMode,
  isFingerprintEnabled,
}: Props) {
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

      <PopupMenu
        trigger={
          <IconChip>
            <EllipsisVerticalIcon size={20} color={COLOR.softWhite} />
          </IconChip>
        }
      >
        {!isDeleteMode ? (
          <>
            <PopupMenuOption
              label={t("trashednotes.settings.delete_all")}
              trailing={<TrashIcon size={16} color={COLOR.textSecondary} />}
              onSelect={() => unlockWithSecret(() => setShowDeleteAllNotesDialog(true))}
            />

            <PopupMenuOption
              label={t("trashednotes.settings.restore_all")}
              trailing={<ArrowPathIcon size={16} color={COLOR.textSecondary} />}
              onSelect={() => setShowRestoreAllNotesDialog(true)}
            />
          </>
        ) : (
          <>
            <PopupMenuOption
              label={t("trashednotes.settings.delete_selected")}
              trailing={<TrashIcon size={16} color={COLOR.textSecondary} />}
              onSelect={() => {
                if (isNoteProtected) {
                  unlockWithSecret(() => setShowDeleteSelectedNotesDialog(true));
                } else {
                  setShowDeleteSelectedNotesDialog(true);
                }
              }}
            />

            <PopupMenuOption
              label={t("trashednotes.settings.restore_selected")}
              trailing={<ArrowPathIcon size={16} color={COLOR.textSecondary} />}
              onSelect={() => setShowRestoreSelectedNotesDialog(true)}
            />
          </>
        )}
      </PopupMenu>
    </>
  );
}
