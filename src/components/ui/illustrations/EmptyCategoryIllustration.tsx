import { StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import CategoryIcon from "@/components/CategoryIcon";
import { GHOST, ILLUSTRATION, illustrationStyles, LINE, LIT, TILE } from "@/components/ui/illustrations/tokens";
import { COLOR } from "@/constants/styles";

interface Props {
  /** The icon of the category being shown, drawn in the card's tile. */
  categoryIcon: string;
}

/** Spec appendix A.2: a lit card with a folder's tab holding the category's icon, two ghosts behind it. */
export default function EmptyCategoryIllustration({ categoryIcon }: Props) {
  return (
    <View style={illustrationStyles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION.width} height={ILLUSTRATION.height} viewBox="0 0 176 112">
        <Rect x={17} y={66} width={142} height={40} rx={13} opacity={0.4} {...GHOST} />
        <Rect x={9} y={42} width={158} height={42} rx={13} opacity={0.7} {...GHOST} />
        <Path
          d="M15 14h36a9 9 0 0 1 8 5l2 3h100a13 13 0 0 1 13 13v14a13 13 0 0 1-13 13H15A13 13 0 0 1 2 49V27A13 13 0 0 1 15 14z"
          {...LIT}
        />
        <Rect x={13} y={29} width={24} height={24} rx={8} fill={TILE} />
        <Rect x={47} y={33} width={80} {...LINE} />
        <Rect x={47} y={44} width={48} {...LINE} opacity={0.6} />
      </Svg>
      <View style={styles.icon}>
        <CategoryIcon name={categoryIcon} size={ICON_SIZE} color={COLOR.textPrimary} />
      </View>
    </View>
  );
}

const ICON_SIZE = 12;

const styles = StyleSheet.create({
  // Centred in the tile (x13 y29, 24 x 24).
  icon: {
    position: "absolute",
    left: 13,
    top: 29,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
