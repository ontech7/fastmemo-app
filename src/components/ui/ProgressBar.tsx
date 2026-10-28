import { StyleSheet, View } from "react-native";

import type { StyleProp, ViewStyle } from "react-native";

import { COLOR, SHADOW } from "@/constants/styles";

interface Props {
  /** 0 to 1. */
  progress: number;
  /** Bar height (default 4). */
  thickness?: number;
  /** A soft accent glow around the filled part: for a bar that is the focus of its surface (a dialog). */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A thin determinate progress bar (a download under way). */
export default function ProgressBar({ progress, thickness = 4, glow = false, style }: Props) {
  const percent = Math.min(Math.max(progress, 0), 1) * 100;
  const radius = thickness / 2;

  return (
    <View
      style={[styles.track, { height: thickness, borderRadius: radius }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
    >
      <View style={[styles.fill, glow && styles.glow, { width: `${percent}%`, borderRadius: radius }]} />
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  // not clipped (no overflow hidden): the fill is rounded itself, and its glow must show around it
  track: {
    backgroundColor: COLOR.surfaceMuted,
  },
  fill: {
    height: "100%",
    backgroundColor: COLOR.accentMuted,
  },
  glow: {
    ...SHADOW.glow,
  },
});
