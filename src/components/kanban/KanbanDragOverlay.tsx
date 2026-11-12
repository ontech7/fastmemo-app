import { LIFT } from "@/constants/styles";
import { useKanbanDrag, useKanbanDragged, useKanbanPreview } from "@/providers/KanbanDragProvider";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { KanbanCardStatic } from "./KanbanCard";

/*
 * The drag's layer over the board: the lifted card following the pointer. It moves with transforms only, on the UI
 * thread. The board's root is the layer's origin; the rectangles are in window coordinates, so the board's own box
 * (measured at lift) is subtracted. Where it will land is shown by the columns themselves (the slot), not here.
 */
export default function KanbanDragOverlay() {
  const dragged = useKanbanDragged();
  const preview = useKanbanPreview();
  const { pointerX, pointerY, grabX, grabY, liftWidth, layout, returning } = useKanbanDrag();
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
      if (now === 1 && previous !== 1) lifted.set(withTiming(0, { duration: LIFT.settleMs }));
    }
  );

  const cardStyle = useAnimatedStyle(() => {
    const board = layout.get()?.board;
    const t = lifted.get();
    return {
      width: liftWidth.get(),
      transform: [
        { translateX: pointerX.get() - grabX.get() - (board?.x ?? 0) },
        { translateY: pointerY.get() - grabY.get() - (board?.y ?? 0) },
        { rotate: `${LIFT.tilt * t}deg` },
        { scale: 1 + (LIFT.scale - 1) * t },
      ] as const,
    };
  });

  if (!dragged) return null;

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.card, cardStyle]}>
        <KanbanCardStatic item={dragged.item} height={preview?.height} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
    zIndex: 1000,
  },
  card: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
