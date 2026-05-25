import React from "react";
import { StyleSheet, View } from "react-native";

import { COLOR, GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  children: React.ReactNode;
  isLast: boolean;
}

export default function SectionItemList({ children, isLast }: Props) {
  return <View style={[styles.sectionItemList, isLast && styles.sectionItemList_last]}>{children}</View>;
}

/* STYLES */

const styles = StyleSheet.create({
  sectionItemList: {
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    // A fixed 1px line renders consistently across pixel densities; hairlineWidth
    // lands on fractional pixels and visibly drops out on some rows.
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
});
