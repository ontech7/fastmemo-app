import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import BookOpenIcon from "react-native-heroicons/outline/BookOpenIcon";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressReadOnly: () => void;
  focusable?: boolean;
}

export default function ReadOnlyNotesButton({ onPressReadOnly, focusable }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.readOnlyNoteButton}
      onPress={onPressReadOnly}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={t("note.settings.readonly")}
    >
      <BookOpenIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  readOnlyNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
