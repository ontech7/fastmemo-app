import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

/** Spec appendix A.5: two ghost cards and the top card broken in two, in soft red. 176 x 112, hidden from screen readers. */
const GHOST = { fill: "rgba(255,255,255,0.025)", stroke: "rgba(255,255,255,0.22)", strokeWidth: 1.5, strokeDasharray: "5 4" };
const BROKEN = {
  fill: "rgba(242,109,109,0.09)",
  stroke: "rgba(242,109,109,0.75)",
  strokeWidth: 1.5,
  strokeLinejoin: "round" as const,
};
const BROKEN_TILE = "rgba(242,109,109,0.30)";
const LINE = "rgba(255,255,255,0.28)";

export default function CrashIllustration() {
  return (
    <View style={styles.box} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={176} height={112} viewBox="0 0 176 112">
        <Rect x={17} y={64} width={142} height={42} rx={13} opacity={0.4} {...GHOST} />
        <Rect x={9} y={38} width={158} height={44} rx={13} opacity={0.7} {...GHOST} />
        <Path d="M15 4H84L77 15L86 27L77 39L84 50H15A13 13 0 0 1 2 37V17A13 13 0 0 1 15 4Z" {...BROKEN} />
        <Rect x={13} y={15} width={24} height={24} rx={8} fill={BROKEN_TILE} />
        <Rect x={45} y={19} width={26} height={5} rx={2.5} fill={LINE} />
        <Rect x={45} y={30} width={18} height={5} rx={2.5} fill={LINE} opacity={0.6} />
        <G transform="translate(6 7) rotate(6 130 27)">
          <Path d="M92 4H155A13 13 0 0 1 168 17V37A13 13 0 0 1 155 50H92L85 39L94 27L85 15Z" {...BROKEN} />
          <Rect x={102} y={19} width={46} height={5} rx={2.5} fill={LINE} />
          <Rect x={102} y={30} width={28} height={5} rx={2.5} fill={LINE} opacity={0.6} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 176,
    height: 112,
  },
});
