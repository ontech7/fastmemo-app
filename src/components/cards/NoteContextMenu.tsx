import { useTranslation } from "react-i18next";
import ArrowTopRightOnSquareIcon from "react-native-heroicons/outline/ArrowTopRightOnSquareIcon";
import BookOpenIcon from "react-native-heroicons/outline/BookOpenIcon";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import DocumentDuplicateIcon from "react-native-heroicons/outline/DocumentDuplicateIcon";
import EyeSlashIcon from "react-native-heroicons/outline/EyeSlashIcon";
import KeyIcon from "react-native-heroicons/outline/KeyIcon";
import StarIcon from "react-native-heroicons/outline/StarIcon";
import TagIcon from "react-native-heroicons/outline/TagIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";

import PopupMenu, { PopupMenuDivider, PopupMenuOption } from "@/components/ui/PopupMenu";
import { COLOR } from "@/constants/styles";
import type { Note } from "@/types";

type Flag = "important" | "protect" | "readOnly" | "hide";

interface Props {
  /** The note that was right-clicked. */
  note: Note | null;
  at: { x: number; y: number } | null;
  /** The right-clicked note is part of a selection of several: the menu acts on all of them. */
  selectionCount: number;
  onOpen: () => void;
  onToggle: (flag: Flag) => void;
  onDuplicate: () => void;
  onChangeCategory: () => void;
  onTrash: () => void;
  onClose: () => void;
}

const FLAGS: { flag: Flag; label: string; on: (note: Note) => boolean; Icon: typeof StarIcon }[] = [
  { flag: "important", label: "note.settings.important", on: (note) => !!note.important, Icon: StarIcon },
  { flag: "protect", label: "note.settings.protect", on: (note) => !!note.locked, Icon: KeyIcon },
  { flag: "readOnly", label: "note.settings.readonly", on: (note) => !!note.readOnly, Icon: BookOpenIcon },
  { flag: "hide", label: "note.settings.hide", on: (note) => !!note.hidden, Icon: EyeSlashIcon },
];

/**
 * A note's menu at the pointer, on a right click on the desktop's home (spec C.2): Open · the four flags, ticked when on ·
 * Duplicate, Change category · Move to trash. On a selection of several, only the flags (no ticks: the notes may differ)
 * and Move to trash, acting on all of them.
 */
export default function NoteContextMenu({
  note,
  at,
  selectionCount,
  onOpen,
  onToggle,
  onDuplicate,
  onChangeCategory,
  onTrash,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const several = selectionCount > 1;

  return (
    <PopupMenu at={note ? at : null} anchor="corner" onClose={onClose}>
      {note && (
        <>
          {!several && (
            <>
              <PopupMenuOption
                label={t("note.settings.open")}
                trailing={<ArrowTopRightOnSquareIcon size={16} color={COLOR.textSecondary} />}
                onSelect={onOpen}
              />
              <PopupMenuDivider />
            </>
          )}

          {FLAGS.map(({ flag, label, on, Icon }) => {
            const ticked = !several && on(note);
            return (
              <PopupMenuOption
                key={flag}
                label={t(label)}
                selected={several ? undefined : ticked}
                leading={ticked ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
                trailing={<Icon size={16} color={COLOR.textSecondary} />}
                onSelect={() => onToggle(flag)}
              />
            );
          })}

          {!several && (
            <>
              <PopupMenuDivider />
              <PopupMenuOption
                label={t("note.settings.duplicate")}
                trailing={<DocumentDuplicateIcon size={16} color={COLOR.textSecondary} />}
                onSelect={onDuplicate}
              />
              <PopupMenuOption
                label={t("note.settings.changecategory")}
                trailing={<TagIcon size={16} color={COLOR.textSecondary} />}
                onSelect={onChangeCategory}
              />
            </>
          )}

          <PopupMenuDivider />
          <PopupMenuOption
            label={t("note.settings.move_to_trash")}
            destructive
            trailing={<TrashIcon size={16} color={COLOR.dangerSoft} />}
            onSelect={onTrash}
          />
        </>
      )}
    </PopupMenu>
  );
}
