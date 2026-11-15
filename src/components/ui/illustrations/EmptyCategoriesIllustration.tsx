import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { ACCENT_STROKE, GHOST, ILLUSTRATION, illustrationStyles, LINE, LIT } from "@/components/ui/illustrations/tokens";

/**
 * No category besides "All": the first category still to make, lit, its tile holding a +, two ghost categories under it.
 * Hidden from screen readers.
 */
export default function EmptyCategoriesIllustration() {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <Rect x={10} y={80} width={156} height={28} rx={10} opacity={0.4} {...GHOST} />
        <Rect x={20} y={86} width={16} height={16} rx={5} opacity={0.4} {...GHOST} strokeDasharray={undefined} />
        <Rect x={46} y={91.5} width={62} {...LINE} opacity={0.3} />

        <Rect x={6} y={42} width={164} height={30} rx={10} opacity={0.7} {...GHOST} />
        <Rect x={16} y={49} width={16} height={16} rx={5} opacity={0.7} {...GHOST} strokeDasharray={undefined} />
        <Rect x={42} y={54.5} width={80} {...LINE} opacity={0.45} />

        <Rect x={2} y={4} width={172} height={30} rx={10} {...LIT} />
        <Rect x={11} y={10} width={18} height={18} rx={6} {...GHOST} stroke={LIT.stroke} />
        <Path d="M20 14.5v9M15.5 19h9" {...ACCENT_STROKE} strokeWidth={2} />
        <Rect x={38} y={16.5} width={92} {...LINE} />
      </Svg>
    </View>
  );
}
