import React from "react";
import { StyleSheet, View } from "react-native";

import { BORDER } from "@/constants/styles";

export default function SectionList({ children }) {
  return <View style={styles.sectionList}>{children}</View>;
}

/* STYLES */

const styles = StyleSheet.create({
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
});
