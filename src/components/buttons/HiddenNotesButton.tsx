import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import EyeSlashIcon from "react-native-heroicons/outline/EyeSlashIcon";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressHidden: () => void;
}

export default function HiddenNotesButton({ onPressHidden }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.hiddenNoteButton}
      onPress={onPressHidden}
      accessibilityRole="button"
      accessibilityLabel={t("note.settings.hide")}
    >
      <EyeSlashIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  hiddenNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
