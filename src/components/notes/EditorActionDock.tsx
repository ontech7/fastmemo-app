import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared bottom dock for an editor's quick actions (AI, voice, todo mode, add row…).
 * A full-width row with a hairline top divider, pinned below the editor content, so
 * every note type (text / todo / kanban / code) surfaces its auxiliary actions in the
 * same place and style instead of floating FABs.
 *
 * Lay a left cluster (wrap it in {@link dockGroupStyle}) and an optional right primary
 * button as the two children — `space-between` splits them. Pass {@link dockButtonStyle}
 * to each action so its default floating-FAB absolute positioning is neutralized inline.
 */
export default function EditorActionDock({ children, style }: Props) {
  return <View style={[styles.dock, style]}>{children}</View>;
}

/** Left cluster of inline actions inside the dock. */
export const dockGroupStyle: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: PADDING_MARGIN.md,
};

/** Neutralizes the floating-FAB absolute positioning of an action button so it sits inline. */
export const dockButtonStyle: ViewStyle = {
  position: "relative",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  dock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingTop: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS.border,
  },
});
