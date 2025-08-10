import React from "react";
import { StyleSheet, View } from "react-native";

import { PADDING_MARGIN } from "@/constants/styles";

export default function SectionWrapper({ children }) {
  return <View style={styles.sectionWrapper}>{children}</View>;
}

/* STYLES */

const styles = StyleSheet.create({
  sectionWrapper: {
    marginBottom: PADDING_MARGIN.xl,
  },
});
