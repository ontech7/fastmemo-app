import { Dialog, DialogAction, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@ontech7/react-native-dialog";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  BookOpenIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  KeyIcon,
  SignalSlashIcon,
  StarIcon,
} from "react-native-heroicons/outline";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { formatDateTime, reverseDate } from "@/utils/date";

import type { Note } from "@/types";

interface Props {
  open: boolean;
  note: Note;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
}

export default function NoteInfoDialog({ open, note, onClose }: Props) {
  const { t } = useTranslation();

  const { type, date, createdAt, updatedAt, category, important, locked, readOnly, hidden, local } = note;

  const noteType = type || "text";
  const TypeIcon = NOTE_TYPES.find((nt) => nt.key === noteType)?.icon;
  const typeLabel = t(`note.type.${noteType}`);

  const createdTimestamp = Number(createdAt) || Number(new Date(reverseDate(date)));
  const updatedTimestamp = Number(updatedAt) || Number(new Date(reverseDate(date)));

  const categoryName = category.index ? t("All") : category.name;

  const flags = [
    important && { key: "important", label: t("note.settings.important"), Icon: StarIcon },
    locked && { key: "locked", label: t("note.settings.protect"), Icon: KeyIcon },
    readOnly && { key: "readOnly", label: t("note.settings.readonly"), Icon: BookOpenIcon },
    hidden && { key: "hidden", label: t("note.settings.hide"), Icon: EyeSlashIcon },
    local && { key: "local", label: t("note.info.offline"), Icon: SignalSlashIcon },
  ].filter(Boolean) as { key: string; label: string; Icon: typeof StarIcon }[];

  return (
    <Dialog open={open} slideFrom="center" onPressOut={onClose}>
      <DialogHeader>
        <DialogTitle adornmentStart={<InformationCircleIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}>
          {t("note.info.title")}
        </DialogTitle>
      </DialogHeader>

      <DialogBody style={styles.body}>
        <View style={styles.typeRow}>
          {TypeIcon && (
            <View style={styles.typeChip}>
              <TypeIcon size={16} color={COLOR.accentSoft} />
            </View>
          )}
          <Text style={styles.typeLabel}>{typeLabel}</Text>
        </View>

        <InfoRow label={t("note.info.category")} value={categoryName} />
        <InfoRow label={t("note.info.created")} value={formatDateTime(createdTimestamp)} />
        <InfoRow label={t("note.info.updated")} value={formatDateTime(updatedTimestamp)} />

        <View style={styles.flagsBlock}>
          <Text style={styles.label}>{t("note.info.flags")}</Text>
          {flags.length === 0 ? (
            <Text style={styles.value}>{t("note.info.no_flags")}</Text>
          ) : (
            <View style={styles.flagsRow}>
              {flags.map(({ key, label, Icon }) => (
                <View key={key} style={styles.flagChip}>
                  <Icon size={13} color={COLOR.textSecondary} />
                  <Text style={styles.flagLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </DialogBody>

      <DialogFooter>
        <DialogAction onPress={onClose}>{t("note.info.close")}</DialogAction>
      </DialogFooter>
    </Dialog>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  body: {
    gap: PADDING_MARGIN.md,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xs,
  },
  typeChip: {
    width: 28,
    height: 28,
    borderRadius: BORDER.small,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fillStrong,
  },
  typeLabel: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
  },
  label: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  flagsBlock: {
    gap: PADDING_MARGIN.sm,
  },
  flagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PADDING_MARGIN.sm,
  },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 4,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  flagLabel: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
});
