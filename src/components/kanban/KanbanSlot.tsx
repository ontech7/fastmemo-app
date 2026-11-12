import DropSlot, { ROW_DELETE_INSET } from "@/components/ui/DropSlot";
import { PADDING_MARGIN } from "@/constants/styles";
import { useKanbanDrag } from "@/providers/KanbanDragProvider";
import { useEffect, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

/** While a card is in the air, the cards slide to open its slot and close its place, and the slot moves the same way. */
export const CARD_LAYOUT = LinearTransition.duration(160);

interface Props {
  /** The lifted card's height: the slot is the place it will take. */
  height: number;
}

/*
 * Where the lifted card will land (ADR-037). It is shown inside the card it opens above (or after the last card), so the
 * cards slide to open it and none changes place in the tree. The lifted card settles into it at the end, measured then.
 */
export default function KanbanSlot({ height }: Props) {
  const { registerSlot } = useKanbanDrag();
  const ref = useRef<ViewInstance>(null);
  useEffect(() => registerSlot(ref), [registerSlot]);

  return (
    <Animated.View layout={CARD_LAYOUT} style={styles.container}>
      <View ref={ref}>
        <DropSlot height={height} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: PADDING_MARGIN.sm,
    marginRight: ROW_DELETE_INSET,
  },
});
