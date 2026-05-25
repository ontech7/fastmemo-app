import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useDispatch, useSelector } from "react-redux";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import IconChip from "@/components/ui/IconChip";
import PopupMenu, { PopupMenuOption } from "@/components/ui/PopupMenu";
import { useRouter } from "@/hooks/useRouter";
import { stripHtml } from "@/libs/ai";
import { exportAsPdf, exportAsTextFile, htmlToMarkdown } from "@/utils/export";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";

import { COLOR } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { temporaryDeleteNote } from "@/slicers/notesSlice";
import { selectorWebhook_temporaryDeleteNote } from "@/slicers/settingsSlice";

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
    <>
      <PopupMenu
        trigger={
          <IconChip>
            <EllipsisVerticalIcon size={20} color={COLOR.softWhite} />
          </IconChip>
        }
      >
        <PopupMenuOption
          label={t("note.settings.delete")}
          disabled={!id}
          trailing={<TrashIcon size={16} color={COLOR.textSecondary} />}
          onSelect={deleteNoteFromItems}
        />

        <PopupMenuOption
          label={t("note.settings.important")}
          selected={important}
          leading={important ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
          trailing={<StarIcon size={16} color={COLOR.textSecondary} />}
          onSelect={toggleImportantNoteFromItems}
        />

        <PopupMenuOption
          label={t("note.settings.protect")}
          selected={locked}
          leading={locked ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
          trailing={<KeyIcon size={16} color={COLOR.textSecondary} />}
          onSelect={toggleProtectedNoteFromItems}
        />

        <PopupMenuOption
          label={t("note.settings.readonly")}
          selected={readOnly}
          leading={readOnly ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
          trailing={<BookOpenIcon size={16} color={COLOR.textSecondary} />}
          onSelect={toggleReadOnlyNoteFromItems}
        />

        <PopupMenuOption
          label={t("note.settings.hide")}
          selected={hidden}
          leading={hidden ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
          trailing={<EyeSlashIcon size={16} color={COLOR.textSecondary} />}
          onSelect={toggleHiddenNoteFromItems}
        />

        {note.createdAt !== note.updatedAt && (
          <PopupMenuOption
            label={t("note.settings.changecategory")}
            disabled={!id}
            trailing={<TagIcon size={16} color={COLOR.textSecondary} />}
            onSelect={changeCategory}
          />
        )}

        {type === "text" && note.createdAt !== note.updatedAt && (
          <PopupMenuOption
            label={t("note.settings.export")}
            disabled={!id}
            trailing={<ArrowUpTrayIcon size={16} color={COLOR.textSecondary} />}
            onSelect={() => setShowExportDialog(true)}
          />
        )}
      </PopupMenu>

      <ComplexDialog
        open={showExportDialog}
        title={t("note.settings.export")}
        description={t("note.settings.export_description")}
        confirm={{ label: "PDF", handler: handleExportPdf }}
        alternative={{ label: "Markdown", handler: handleExportMarkdown }}
        cancel={{ label: t("note.settings.export_txt"), handler: handleExportTxt }}
        actionsColumn
      />
    </>
  );
}
