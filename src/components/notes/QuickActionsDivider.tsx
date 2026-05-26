import { StyleSheet, View } from "react-native";

import { GLASS } from "@/constants/styles";

interface Props {
  /** Distance from the screen bottom, placed just above the floating action row. */
  bottom: number;
}

/**
 * Full-width hairline separating the note content from the floating bottom
 * quick-action buttons (AI, voice, mode...). Mirrors the divider above the
 * action dock in NoteTextEditor for editors whose actions float instead — it
 * spans edge to edge (no side inset).
 */
export default function QuickActionsDivider({ bottom }: Props) {
  return <View style={[styles.divider, { bottom }]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  divider: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.border,
    zIndex: 1,
  },
});
