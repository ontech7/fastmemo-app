import { memo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { BORDER, COLOR, GLASS, PADDING_MARGIN } from "@/constants/styles";

import CategoryIcon from "@/components/CategoryIcon";

interface Props {
  name: string;
  selected: boolean;
  toggleCategoryIcon: (name: string) => void;
}

function UnusedCategoryButton({ name, selected, toggleCategoryIcon }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.button, selected && styles.selectedButton]}
      onPress={() => toggleCategoryIcon(name)}
    >
      <CategoryIcon name={name} color={selected ? COLOR.softWhite : COLOR.textPrimary} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  button: {
    padding: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  selectedButton: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
});

export default memo(UnusedCategoryButton);
