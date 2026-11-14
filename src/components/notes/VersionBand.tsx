import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { VersionReason } from "@/libs/history";
import { versionDay } from "@/libs/history/labels";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { formatTime } from "@/utils/date";

/** A kept version on screen in its note's editor (spec B.9). */
export interface VersionPreview {
  at: number;
  reason: VersionReason;
  /** false for a read-only note: Close alone. */
  canRestore: boolean;
  onRestore: () => void;
  onClose: () => void;
}

interface Props {
  preview: VersionPreview;
}

/** Under the editor's header while a kept version is shown: when and why it was kept, Restore and Close. */
export default function VersionBand({ preview }: Props) {
  const { t } = useTranslation();
  const { at, reason, canRestore, onRestore, onClose } = preview;

  return (
    <View style={styles.band}>
      <Text style={styles.when} accessibilityRole="header">
        {versionDay(at, t)}, {formatTime(at)}
      </Text>
      <Text style={styles.reason}>{t(`history.reason.${reason}`)}</Text>
      <View style={styles.buttons}>
        {canRestore && (
          <TouchableOpacity style={[styles.button, styles.restore]} onPress={onRestore} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("history.restore")}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("history.close")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    marginTop: PADDING_MARGIN.md,
    marginHorizontal: PADDING_MARGIN.lg,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal + 2,
    borderWidth: 1,
    borderColor: COLOR.accentMutedBorder,
    backgroundColor: COLOR.accentFaint,
  },
  when: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  reason: {
    marginTop: 2,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  buttons: {
    flexDirection: "row",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.md,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: PADDING_MARGIN.sm + 1,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.fill,
  },
  restore: {
    borderColor: COLOR.accentMutedBorder,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.glow,
  },
  buttonText: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
});
