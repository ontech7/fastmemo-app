import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { BORDER, GLASS } from "@/constants/styles";

interface Props {
  children: ReactNode;
}

/**
 * Square glass chip used to give header action icons (filters, delete, ...) a
 * consistent tap target and surface instead of floating as a bare icon.
 */
export default function IconChip({ children }: Props) {
  return <View style={styles.chip}>{children}</View>;
}

/* STYLES */

const styles = StyleSheet.create({
  chip: {
    width: 42,
    height: 42,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
});
