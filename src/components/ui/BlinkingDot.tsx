import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { COLOR } from "@/constants/styles";

interface Props {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Small dot that fades in and out on a loop — an unobtrusive "needs attention" cue. */
export default function BlinkingDot({ size = 8, color = COLOR.accentSoft, style }: Props) {
  const blink = useSharedValue(1);

  useEffect(() => {
    blink.value = withRepeat(withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [blink]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedStyle, style]}
    />
  );
}
