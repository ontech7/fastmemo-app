import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";

import { BORDER, COLOR, PADDING_MARGIN, SHADOW } from "@/constants/styles";

interface Props {
  onPress: () => void;
  color?: string | null;
}

export default function SaveButton({ onPress, color = null }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.addBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.save")}
    >
      <CheckIcon size={28} color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    position: "absolute",
    bottom: 60,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
});
