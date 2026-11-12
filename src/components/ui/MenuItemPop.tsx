import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

interface Props {
  /** The item's place in the menu, from the top. */
  index: number;
  /** How many items the menu has. */
  total: number;
  /** The menu's open progress: 0 closed, 1 open. */
  progress: SharedValue<number>;
  children: ReactNode;
}

/** How much later each item starts than the one below it, and how long its own part of the progress lasts. */
const STAGGER = 0.15;
const SPAN = 0.6;

/*
 * The staggered pop the overlay menus' items share (the note-type menu, the list-mode menu, the AI menu): each item fades
 * in, rises 20 dp and grows from 80%, the bottom one first, and goes out the same way as the menu closes.
 */
export default function MenuItemPop({ index, total, progress, children }: Props) {
  const reverseIndex = total - 1 - index;

  const style = useAnimatedStyle((): ViewStyle => {
    const start = reverseIndex * STAGGER;
    const item = interpolate(progress.value, [start, Math.min(start + SPAN, 1)], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: item,
      transform: [{ translateY: interpolate(item, [0, 1], [20, 0]) }, { scale: interpolate(item, [0, 1], [0.8, 1]) }],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}
