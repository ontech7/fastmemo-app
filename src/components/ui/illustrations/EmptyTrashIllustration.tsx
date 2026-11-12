import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

import { BACKDROP, GHOST, ILLUSTRATION, illustrationStyles, LINE, LIT } from "@/components/ui/illustrations/tokens";

/** Spec appendix A.4: a ghost card tilted over the trash's box (the trash button's icon). Hidden from screen readers. */
export default function EmptyTrashIllustration() {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <G transform="rotate(-9 88 28)">
          <Rect x={28} y={6} width={120} height={38} rx={12} {...GHOST} />
          <Rect x={60} y={17} width={52} {...LINE} opacity={0.5} />
          <Rect x={60} y={27} width={32} {...LINE} opacity={0.3} />
        </G>
        <Rect x={40} y={52} width={96} height={16} rx={6} fill={BACKDROP} />
        <Rect x={40} y={52} width={96} height={16} rx={6} {...LIT} />
        <Path d="M46 68h84v30a10 10 0 0 1-10 10H56a10 10 0 0 1-10-10z" {...LIT} />
        <Rect x={74} y={80} width={28} {...LINE} />
      </Svg>
    </View>
  );
}
