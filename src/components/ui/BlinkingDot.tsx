import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { COLOR } from "@/constants/styles";

interface Props {
  size?: number;
  color?: string;
  /** "blink" fades it in and out, "ping" sends a ring out of it (something live), "none" keeps it still. */
  animation?: "blink" | "ping" | "none";
  /** What it means, for a screen reader (none: it only decorates a text that says it). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Small dot that fades in and out on a loop — an unobtrusive "needs attention" cue — or pings, or stays still. */
export default function BlinkingDot({
  size = 8,
  color = COLOR.accentSoft,
  animation = "blink",
  accessibilityLabel,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const blink = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    blink.value = animation === "blink" && !reduceMotion ? withRepeat(withTiming(0.2, BLINK), -1, true) : 1;
    ring.value = animation === "ping" && !reduceMotion ? withRepeat(withTiming(1, PING), -1, false) : 0;
  }, [animation, reduceMotion, blink, ring]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.6 * (1 - ring.value),
    transform: [{ scale: 1 + 1.6 * ring.value }],
  }));

  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!accessibilityLabel}
      focusable={false}
    >
      {animation === "ping" && <Animated.View style={[StyleSheet.absoluteFill, dot, ringStyle]} />}
      <Animated.View style={[dot, animatedStyle]} />
    </View>
  );
}

const BLINK = { duration: 700, easing: Easing.inOut(Easing.ease) };
const PING = { duration: 1600, easing: Easing.out(Easing.ease) };
