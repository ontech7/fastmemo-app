import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";
import { StyleSheet, View } from "react-native";

/** A row's delete button (32) and its gap: a slot stops where the row's body does. */
export const ROW_DELETE_INSET = 32 + PADDING_MARGIN.sm;

interface Props {
  /** The dragged item's height. */
  height: number;
}

/*
 * Where a dragged card or row will land (kanban boards, lists): an empty place of its size, outlined in the accent so it
 * reads at a glance under a finger. Shown by what holds it; it draws nothing else.
 */
export default function DropSlot({ height }: Props) {
  return <View style={[styles.slot, { height }]} aria-hidden focusable={false} />;
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLOR.accentSoft,
    backgroundColor: COLOR.accentFaint,
  },
});
