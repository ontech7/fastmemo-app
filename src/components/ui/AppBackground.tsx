import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { COLOR } from "@/constants/styles";

interface Props {
  style?: StyleProp<ViewStyle>;
}

// A single 0→1 radial stop interpolates linearly and shows visible concentric
// banding on the dark backdrop. Spreading many stops along an eased (quadratic)
// opacity falloff approximates a smooth curve and removes the rings.
const GLOW_OFFSETS = [0, 0.12, 0.25, 0.38, 0.52, 0.66, 0.82, 1];

function glowStops(color: string, peak: number) {
  return GLOW_OFFSETS.map((t) => (
    <Stop key={t} offset={`${Math.round(t * 100)}%`} stopColor={color} stopOpacity={+(peak * (1 - t) ** 2).toFixed(4)} />
  ));
}

/**
 * Deep, near-solid app background with soft accent glows in the top-right and
 * bottom-left corners. The contrast lives in cards/accents, not the backdrop.
 * Static and cheap (no blur, single SVG radial fill).
 */
export default function AppBackground({ style }: Props) {
  return (
    <View style={[styles.base, style]} pointerEvents="none">
      {/* width/height as props (not just style) — react-native-svg on web sizes
          the <svg> from these, otherwise it collapses to a small top-left box. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glowTop" cx="88%" cy="-2%" rx="70%" ry="55%">
            {glowStops(COLOR.accent, 0.28)}
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="6%" cy="104%" rx="55%" ry="45%">
            {glowStops(COLOR.accentDeep, 0.18)}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowTop)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBottom)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLOR.bg,
  },
});
