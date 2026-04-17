import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ArrowUpTrayIcon,
  BookOpenIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  EyeSlashIcon,
  KeyIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useDispatch, useSelector } from "react-redux";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import { useRouter } from "@/hooks/useRouter";
import { stripHtml } from "@/libs/ai";
import { exportAsPdf, exportAsTextFile, htmlToMarkdown } from "@/utils/export";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { temporaryDeleteNote } from "../../slicers/notesSlice";
import { selectorWebhook_temporaryDeleteNote } from "../../slicers/settingsSlice";
import ContextMenu from "../renderers/ContextMenu";

import type { Note, TextNote } from "@/types";

interface Props {
  note: Note;
  setNote: (note: Note) => void;
}

export default function NoteSettingsButton({ note, setNote }: Props) {
  const { t } = useTranslation();

  const router = useRouter();

  const { id, type, title, important, readOnly, hidden, locked } = note;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();
  const { unlockWithSecret } = useSecret();

  const [showExportDialog, setShowExportDialog] = useState(false);

  const sanitizeFilename = (name: string) => (name || "note").replace(/[^a-zA-Z0-9-_ ]/g, "").substring(0, 50);

  const handleExportPdf = useCallback(async () => {
    setShowExportDialog(false);
    try {
      if (type !== "text") return;
      const textNote = note as TextNote;
      const result = await exportAsPdf(title, textNote.text);
      if (result?.uri) {
        const { shareFile } = await import("@/utils/export");
        await shareFile(result.uri, `${sanitizeFilename(title)}.pdf`);
      }
    } catch (e: any) {
      console.log("Export PDF error:", e);
      toast(e?.message || t("error"));
    }
  }, [note, title, type, t]);

  const handleExportMarkdown = useCallback(async () => {
    setShowExportDialog(false);
    try {
      if (type !== "text") return;
      const textNote = note as TextNote;
      const md = (title ? `# ${title}\n\n` : "") + htmlToMarkdown(textNote.text);
      await exportAsTextFile(md, `${sanitizeFilename(title)}.md`);
    } catch (e) {
      console.log("Export MD error:", e);
      toast(t("error"));
    }
  }, [note, title, type, t]);

  const handleExportTxt = useCallback(async () => {
    setShowExportDialog(false);
    try {
      if (type !== "text") return;
      const textNote = note as TextNote;
      const txt = (title ? `${title}\n\n` : "") + stripHtml(textNote.text);
      await exportAsTextFile(txt, `${sanitizeFilename(title)}.txt`);
    } catch (e) {
      console.log("Export TXT error:", e);
      toast(t("error"));
    }
  }, [note, title, type, t]);

  const deleteNoteFromItems = () => {
    dispatch(temporaryDeleteNote(id));
    webhook(webhook_temporaryDeleteNote, {
      action: "note/temporaryDeleteNote",
      id: id,
    });
    router.back();
  };

  const toggleImportantNoteFromItems = () => {
    setNote({ ...note, important: !important });
  };

  const toggleProtectedNoteFromItems = () => {
    unlockWithSecret(() => {
      setNote({ ...note, locked: !locked });
    });
  };

  const toggleReadOnlyNoteFromItems = () => {
    setNote({ ...note, readOnly: !readOnly });
  };

  const toggleHiddenNoteFromItems = () => {
    setNote({ ...note, hidden: !hidden });
  };

  const changeCategory = () => {
    router.push({
      pathname: "/categories/change",
      params: {
        noteId: id,
      },
    });
  };

  return (
    <Menu renderer={ContextMenu}>
      <MenuTrigger customStyles={{ TriggerTouchableComponent: TouchableOpacity }}>
        <EllipsisVerticalIcon size={28} color={COLOR.softWhite} />
      </MenuTrigger>

      <MenuOptions customStyles={menuOptionsCustomStyles}>
        <MenuOption style={[styles.menuOption, !id && styles.menuOptionDisabled]} disabled={!id} onSelect={deleteNoteFromItems}>
          <Text style={styles.menuOptionText}>{t("note.settings.delete")}</Text>

          <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleImportantNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {important && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, important && styles.menuOptionTextSelected]}>
              {t("note.settings.important")}
            </Text>
          </View>

          <StarIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleProtectedNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {locked && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, locked && styles.menuOptionTextSelected]}>{t("note.settings.protect")}</Text>
          </View>

          <KeyIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleReadOnlyNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {readOnly && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, readOnly && styles.menuOptionTextSelected]}>
              {t("note.settings.readonly")}
            </Text>
          </View>

          <BookOpenIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleHiddenNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {hidden && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, hidden && styles.menuOptionTextSelected]}>{t("note.settings.hide")}</Text>
          </View>

          <EyeSlashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        {note.createdAt !== note.updatedAt && (
          <MenuOption style={[styles.menuOption, !id && styles.menuOptionDisabled]} disabled={!id} onSelect={changeCategory}>
            <Text style={styles.menuOptionText}>{t("note.settings.changecategory")}</Text>

            <TagIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>
        )}

        {type === "text" && note.createdAt !== note.updatedAt && (
          <MenuOption
            style={[styles.menuOption, !id && styles.menuOptionDisabled]}
            disabled={!id}
            onSelect={() => setShowExportDialog(true)}
          >
            <Text style={styles.menuOptionText}>{t("note.settings.export")}</Text>
            <ArrowUpTrayIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>
        )}
      </MenuOptions>

      <ComplexDialog
        open={showExportDialog}
        title={t("note.settings.export")}
        description={t("note.settings.export_description")}
        confirm={{ label: "PDF", handler: handleExportPdf }}
        alternative={{ label: "Markdown", handler: handleExportMarkdown }}
        cancel={{ label: t("note.settings.export_txt"), handler: handleExportTxt }}
        actionsColumn
      />
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
  menuOptionDisabled: {
    opacity: 0.5,
  },
  menuOptionIcon: {
    marginLeft: PADDING_MARGIN.lg,
  },
  menuOptionText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
  },
  menuOptionTextSelected: {
    fontWeight: FONTWEIGHT.semiBold,
  },
});
