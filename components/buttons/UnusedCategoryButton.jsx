import React, { memo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

import CategoryIcon from "../CategoryIcon";

function UnusedCategoryButton({ name, selected, toggleCategoryIcon }) {
  return (
    <TouchableOpacity style={[styles.button, selected && styles.selectedButton]} onPress={() => toggleCategoryIcon(name)}>
      <CategoryIcon name={name} color={selected ? COLOR.darkBlue : COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  button: {
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.lightBlue,
  },
});

export default memo(UnusedCategoryButton);
