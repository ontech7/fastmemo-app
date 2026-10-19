import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import StarIcon from "react-native-heroicons/outline/StarIcon";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressSave: () => void;
  focusable?: boolean;
}

export default function FavoriteNotesButton({ onPressSave, focusable }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.saveNoteButton}
      onPress={onPressSave}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={t("note.settings.important")}
    >
      <StarIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  saveNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
