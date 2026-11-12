import { LIFT } from "@/constants/styles";
import { useReorder, useReorderDragged, useReorderPreview, type ReorderItem } from "@/providers/ReorderProvider";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface Props<T extends ReorderItem> {
  /** The lifted item's look, read-only, drawn at the height it was measured at (or its own when none). */
  renderLifted: (item: T, height: number | undefined) => ReactNode;
}

/*
 * The drag's layer over the frame: the lifted item following the pointer. It moves with transforms only, on the UI
 * thread. The frame's root is the layer's origin; the rectangles are in window coordinates, so the frame's own box
 * (measured at lift) is subtracted. Where it will land is shown by the containers themselves (the slot), not here.
 */
export default function ReorderOverlay<T extends ReorderItem>({ renderLifted }: Props<T>) {
  const dragged = useReorderDragged<T>();
  const preview = useReorderPreview();
  const { pointerX, pointerY, grabX, grabY, liftWidth, layout, returning } = useReorder();
  const reducedMotion = useReducedMotion();

  // 0 flat, 1 lifted: the tilt and the scale follow it.
  const lifted = useSharedValue(0);
  useEffect(() => {
    if (!dragged) {
      lifted.set(0);
      return;
    }
    lifted.set(reducedMotion ? 1 : withTiming(1, { duration: LIFT.ms }));
  }, [dragged, reducedMotion, lifted]);
  useAnimatedReaction(
    () => returning.get(),
    (now, previous) => {
      if (now === 1 && previous !== 1) lifted.set(withTiming(0, { duration: LIFT.dropMs }));
    }
  );

  const itemStyle = useAnimatedStyle(() => {
    const frame = layout.get()?.frame;
    const t = lifted.get();
    return {
      width: liftWidth.get(),
      transform: [
        { translateX: pointerX.get() - grabX.get() - (frame?.x ?? 0) },
        { translateY: pointerY.get() - grabY.get() - (frame?.y ?? 0) },
        { rotate: `${LIFT.tilt * t}deg` },
        { scale: 1 + (LIFT.scale - 1) * t },
      ] as const,
    };
  });

  if (!dragged) return null;

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.item, itemStyle]}>{renderLifted(dragged.item, preview?.height)}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
    zIndex: 1000,
  },
  item: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
