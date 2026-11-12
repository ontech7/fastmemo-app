import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";
import { isOwnPlace, LINE_INSET } from "@/libs/kanbanDrop";
import { useKanbanColumnWidth, useKanbanDrag, useKanbanDragged } from "@/providers/KanbanDragProvider";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { KanbanCardStatic } from "./KanbanCard";

const LIFT_SCALE = 1.05;
const LIFT_MS = 120;
const LINE_HEIGHT = 3;
const DOT = 9;

/*
 * The drag's layer over the board: the lifted card following the pointer, and the line where it would land. Both move
 * with transforms only, on the UI thread. The board's root is the layer's origin; the rectangles are in window
 * coordinates, so the board's own box (measured at lift) is subtracted.
 */
export default function KanbanDragOverlay() {
  const dragged = useKanbanDragged();
  const columnWidth = useKanbanColumnWidth();
  const { pointerX, pointerY, grabX, grabY, liftWidth, layout, target, sourceColumn, sourceIndex, returning } = useKanbanDrag();
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(1);
  useEffect(() => {
    if (!dragged) {
      scale.set(1);
      return;
    }
    scale.set(reducedMotion ? LIFT_SCALE : withTiming(LIFT_SCALE, { duration: LIFT_MS }));
  }, [dragged, reducedMotion, scale]);

  const cardStyle = useAnimatedStyle(() => {
    const board = layout.get()?.board;
    return {
      width: liftWidth.get(),
      transform: [
        { translateX: pointerX.get() - grabX.get() - (board?.x ?? 0) },
        { translateY: pointerY.get() - grabY.get() - (board?.y ?? 0) },
        { rotate: "-2deg" },
        { scale: scale.get() },
      ] as const,
    };
  });

  const lineStyle = useAnimatedStyle(() => {
    const t = target.get();
    const board = layout.get()?.board;
    const hidden = !t || !board || returning.get() === 1 || isOwnPlace(t, sourceColumn.get(), sourceIndex.get());
    return {
      opacity: hidden ? 0 : 1,
      transform: [
        { translateX: t && board ? t.line.x - board.x : 0 },
        { translateY: t && board ? t.line.y - board.y - LINE_HEIGHT / 2 : 0 },
      ] as const,
    };
  });

  if (!dragged) return null;

  // A constant width: only the line's place animates.
  const lineWidth = columnWidth - PADDING_MARGIN.sm * 2 - LINE_INSET * 2;

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.line, { width: lineWidth }, lineStyle]}>
        <View style={styles.dot} />
      </Animated.View>
      <Animated.View style={[styles.card, cardStyle]}>
        <KanbanCardStatic item={dragged.item} />
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
  line: {
    position: "absolute",
    left: 0,
    top: 0,
    height: LINE_HEIGHT,
    borderRadius: 2,
    backgroundColor: COLOR.accentSoft,
    boxShadow: `0px 0px 10px ${COLOR.accent}`,
  },
  dot: {
    position: "absolute",
    left: -DOT / 2 + 1,
    top: (LINE_HEIGHT - DOT) / 2,
    width: DOT,
    height: DOT,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentSoft,
  },
});
