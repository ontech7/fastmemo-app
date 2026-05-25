import React from "react";
import { StyleSheet, View } from "react-native";

import { BORDER, GLASS } from "@/constants/styles";

interface Props {
  children: React.ReactNode;
}

export default function SectionList({ children }: Props) {
  return <View style={styles.sectionList}>{children}</View>;
}

/* STYLES */

const styles = StyleSheet.create({
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
});
