import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { ACCENT_STROKE, GHOST, ILLUSTRATION, illustrationStyles, LINE, LIT } from "@/components/ui/illustrations/tokens";

/** A list's rows: the first lit, its box still to tick, two ghost rows under it. Hidden from screen readers. */
export default function EmptyListIllustration() {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <Rect x={10} y={80} width={156} height={28} rx={10} opacity={0.4} {...GHOST} />
        <Rect x={20} y={87} width={14} height={14} rx={4} opacity={0.4} {...GHOST} strokeDasharray={undefined} />
        <Rect x={44} y={91.5} width={70} {...LINE} opacity={0.3} />

        <Rect x={6} y={42} width={164} height={30} rx={10} opacity={0.7} {...GHOST} />
        <Rect x={16} y={50} width={14} height={14} rx={4} opacity={0.7} {...GHOST} strokeDasharray={undefined} />
        <Rect x={40} y={54.5} width={88} {...LINE} opacity={0.45} />

        <Rect x={2} y={4} width={172} height={30} rx={10} {...LIT} />
        <Rect x={12} y={11} width={16} height={16} rx={5} {...ACCENT_STROKE} strokeWidth={2} />
        <Rect x={38} y={16.5} width={96} {...LINE} />
      </Svg>
    </View>
  );
}
