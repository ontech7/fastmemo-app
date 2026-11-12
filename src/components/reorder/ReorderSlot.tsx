import DropSlot, { ROW_DELETE_INSET } from "@/components/ui/DropSlot";
import { LIFT, PADDING_MARGIN } from "@/constants/styles";
import { useReorder } from "@/providers/ReorderProvider";
import { useEffect, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewInstance, type ViewStyle } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

/** While an item is in the air, the items slide to open its slot and close its place, and the slot moves the same way. */
export const ITEM_LAYOUT = LinearTransition.duration(LIFT.slideMs);

interface Props {
  /** The lifted item's height: the slot is the place it will take. */
  height: number;
  /** Its margins in what holds it; by default a row's: a gap below, and none under the row's delete button. */
  style?: StyleProp<ViewStyle>;
}

/*
 * Where the lifted item will land (ADR-037, ADR-038). It is shown inside the item it opens above (or after the last one),
 * so the items slide to open it and none changes place in the tree. The lifted item settles into it at the end, measured
 * then.
 */
export default function ReorderSlot({ height, style }: Props) {
  const { registerSlot } = useReorder();
  const ref = useRef<ViewInstance>(null);
  useEffect(() => registerSlot(ref), [registerSlot]);

  return (
    <Animated.View layout={ITEM_LAYOUT} style={[styles.container, style]}>
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
