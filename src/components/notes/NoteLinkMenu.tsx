import { useTranslation } from "react-i18next";
import ArrowTopRightOnSquareIcon from "react-native-heroicons/outline/ArrowTopRightOnSquareIcon";
import PencilIcon from "react-native-heroicons/outline/PencilIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";

import PopupMenu, { PopupMenuOption } from "@/components/ui/PopupMenu";
import { COLOR } from "@/constants/styles";
import type { EditorLink } from "@/libs/richTextEditor";

interface Props {
  /** The link tapped in the editor, and where on screen; null when the menu is closed. */
  link: EditorLink | null;
  at: { x: number; y: number } | null;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/** What can be done to a link of a text note, opened by tapping it: open it, edit it, take the link away. */
export default function NoteLinkMenu({ link, at, onOpen, onEdit, onRemove, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <PopupMenu at={link && at} onClose={onClose}>
      <PopupMenuOption
        label={t("note.link.open")}
        trailing={<ArrowTopRightOnSquareIcon size={16} color={COLOR.textSecondary} />}
        onSelect={onOpen}
      />
      {link?.editable && (
        <PopupMenuOption
          label={t("note.link.edit")}
          trailing={<PencilIcon size={16} color={COLOR.textSecondary} />}
          onSelect={onEdit}
        />
      )}
      {link?.editable && (
        <PopupMenuOption
          label={t("note.link.remove")}
          trailing={<TrashIcon size={16} color={COLOR.textSecondary} />}
          onSelect={onRemove}
        />
      )}
    </PopupMenu>
  );
}
