import React from "react";
import { StyleSheet, Text, View } from "react-native";

import CategoryIcon from "@/components/CategoryIcon";

import {
  BORDER,
  COLOR,
  FONTSIZE,
  FONTWEIGHT,
  PADDING_MARGIN,
} from "@/constants/styles";

export default function SectionHeader({ title, icon }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderIcon}>
        <CategoryIcon name={icon} color={COLOR.softWhite} />
      </View>

      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.lg,
  },
  sectionHeaderIcon: {
    marginRight: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
    paddingVertical: PADDING_MARGIN.sm,
  },
});
