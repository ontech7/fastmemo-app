import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { GHOST, ILLUSTRATION, illustrationStyles, LINE, LIT, TILE } from "@/components/ui/illustrations/tokens";

/** Spec appendix A.1: the first card already lit, two ghosts waiting behind it. Hidden from screen readers. */
export default function EmptyNotesIllustration() {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <Rect x={17} y={62} width={142} height={44} rx={13} opacity={0.4} {...GHOST} />
        <Rect x={9} y={34} width={158} height={44} rx={13} opacity={0.7} {...GHOST} />
        <Rect x={2} y={4} width={172} height={46} rx={13} {...LIT} />
        <Rect x={13} y={15} width={24} height={24} rx={8} fill={TILE} />
        <Rect x={47} y={19} width={88} {...LINE} />
        <Rect x={47} y={30} width={54} {...LINE} opacity={0.6} />
      </Svg>
    </View>
  );
}
