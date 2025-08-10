import React from "react";
import { StyleSheet, View } from "react-native";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function SectionItemList({ children, isLast }) {
  return (
    <View
      style={[styles.sectionItemList, isLast && styles.sectionItemList_last]}
    >
      {children}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  sectionItemList: {
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1.5,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
});
