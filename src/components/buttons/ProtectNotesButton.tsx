import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import KeyIcon from "react-native-heroicons/outline/KeyIcon";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressProtect: () => void;
}

export default function ProtectNotesButton({ onPressProtect }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.protectNoteButton}
      onPress={onPressProtect}
      accessibilityRole="button"
      accessibilityLabel={t("note.settings.protect")}
    >
      <KeyIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  protectNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
