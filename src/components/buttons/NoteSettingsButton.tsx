import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpTrayIcon,
  BookOpenIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  KeyIcon,
  SignalSlashIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import { useDispatch, useSelector, useStore } from "react-redux";
import uuid from "react-uuid";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import NoteInfoDialog from "@/components/dialogs/NoteInfoDialog";
import IconChip from "@/components/ui/IconChip";
import PopupMenu, { PopupMenuOption } from "@/components/ui/PopupMenu";
import { useRouter } from "@/hooks/useRouter";
import { stripHtml } from "@/libs/ai";
import { exportAsPdf, exportAsTextFile, htmlToMarkdown } from "@/utils/export";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";

import { COLOR } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { detachNote, reattachNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import { selectorWebhook_temporaryDeleteNote } from "@/slicers/settingsSlice";

import type { Note, RootState, TextNote } from "@/types";

interface Props {
  note: Note;
  setNote: (note: Note) => void;
}

export default function NoteSettingsButton({ note, setNote }: Props) {
  const { t } = useTranslation();

  const router = useRouter();

  const { id, type, title, important, readOnly, hidden, locked, local } = note;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const { unlockWithSecret } = useSecret();

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const sanitizeFilename = (name: string) => {
    // Strip anything filesystem/share-unsafe, then guarantee a non-empty base name —
    // a title of only emoji/non-Latin chars would otherwise collapse to "" and yield
    // a nameless ".txt" file that receiving apps (e.g. Telegram) reject as unsupported.
    const cleaned = (name || "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 50)
      .trim();
    return cleaned || "note";
  };

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

  // synced -> offline: detach from the cloud and keep the editor state in sync so a
  // later edit does not re-queue the note for upload
  const makeNoteOffline = () => {
    dispatch(detachNote(id));
    setNote({ ...note, local: true });
    toast(t("note.settings.made_offline"));
  };

  // offline -> synced: republished as a brand-new note (new id + " (2)") to avoid any
  // overlap with stale cloud/other-device versions
  const syncNoteToCloud = () => {
    dispatch(reattachNote({ id, newId: uuid() }));
    toast(t("note.settings.synced_as_duplicate"));
    router.back();
  };

  const openExport = () => {
    // Nothing to export from a blank note — exporting would produce an empty file
    // that receiving apps reject, so prompt for content instead of opening the dialog.
    const hasContent = title.trim() !== "" || stripHtml((note as TextNote).text).trim() !== "";
    if (!hasContent) {
      toast(t("ai.editor.no_content"));
      return;
    }
    setShowExportDialog(true);
  };

  const changeCategory = () => {
    // A brand-new note only enters the Redux store on its first edit, so persist the
    // current state first. setNoteAsync drops empty notes instead of saving them, so
    // confirm it actually landed before navigating — the change-category screen looks
    // the note up by id and would silently bounce back if it is missing.
    setNote(note);

    const persisted = store.getState().notes.items.some((n) => n.id === id);
    if (!persisted) {
      toast(t("ai.editor.no_content"));
      return;
    }

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

        <PopupMenuOption
          label={local ? t("note.settings.sync_to_cloud") : t("note.settings.make_offline")}
          disabled={!id}
          selected={!!local}
          leading={local ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
          trailing={<SignalSlashIcon size={16} color={COLOR.textSecondary} />}
          onSelect={local ? syncNoteToCloud : makeNoteOffline}
        />

        <PopupMenuOption
          label={t("note.settings.changecategory")}
          disabled={!id}
          trailing={<TagIcon size={16} color={COLOR.textSecondary} />}
          onSelect={changeCategory}
        />

        {type === "text" && (
          <PopupMenuOption
            label={t("note.settings.export")}
            disabled={!id}
            trailing={<ArrowUpTrayIcon size={16} color={COLOR.textSecondary} />}
            onSelect={openExport}
          />
        )}

        <PopupMenuOption
          label={t("note.settings.info")}
          trailing={<InformationCircleIcon size={16} color={COLOR.textSecondary} />}
          onSelect={() => setShowInfoDialog(true)}
        />
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

      <NoteInfoDialog open={showInfoDialog} note={note} onClose={() => setShowInfoDialog(false)} />
    </>
  );
}
