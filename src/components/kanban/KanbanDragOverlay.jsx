import { useKanbanDrag } from "@/contexts/KanbanDragContext";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { PADDING_MARGIN } from "@/constants/styles";

import { KanbanCardStatic } from "./KanbanCard";

export default function KanbanDragOverlay({ columnWidth }) {
  const { isDragging, draggedItem, dragX, dragY, containerOffsetX, containerOffsetY } = useKanbanDrag();

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: dragX.value - containerOffsetX.value,
    top: dragY.value - containerOffsetY.value,
    width: columnWidth - PADDING_MARGIN.sm * 2,
    zIndex: 1000,
  }));

  if (!isDragging || !draggedItem) return null;

  return (
    <Animated.View style={[animatedStyle, { pointerEvents: "none" }]}>
      <KanbanCardStatic item={draggedItem} />
    </Animated.View>
  );
}
