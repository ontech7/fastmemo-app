import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { ACCENT_STROKE, BACKDROP, GHOST, ILLUSTRATION, illustrationStyles, LINE } from "@/components/ui/illustrations/tokens";

/** Spec appendix A.3: the three cards of A.1, none lit, and a magnifier that finds nothing. Hidden from screen readers. */
export default function EmptySearchIllustration() {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <Rect x={17} y={62} width={142} height={44} rx={13} opacity={0.4} {...GHOST} />
        <Rect x={9} y={34} width={158} height={44} rx={13} opacity={0.7} {...GHOST} />
        <Rect x={2} y={4} width={172} height={46} rx={13} {...GHOST} />
        <Rect x={47} y={19} width={70} {...LINE} opacity={0.5} />
        <Rect x={47} y={30} width={44} {...LINE} opacity={0.3} />
        <Circle cx={128} cy={62} r={19} fill={BACKDROP} />
        <Circle cx={128} cy={62} r={17} {...ACCENT_STROKE} />
        <Path d="M141 75l13 13" {...ACCENT_STROKE} strokeWidth={4} />
      </Svg>
    </View>
  );
}
