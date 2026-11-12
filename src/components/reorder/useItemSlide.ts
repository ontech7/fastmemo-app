import { ITEM_LAYOUT } from "@/components/reorder/ReorderSlot";
import { useReorder, useReorderSliding } from "@/providers/ReorderProvider";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

/**
 * The layout transitions of an item of the reorder engine (ADR-038): `box` for the item's own box (the one that hosts the
 * slot or folds), `inner` for what it shows inside it. They slide while an item is in the air, never in the commits that
 * lift and drop it. The box and what is inside it slide together: the slot opening above an item moves it inside its box
 * while the box itself slides, and only the two together keep every item where it should be at every frame.
 *
 * `enabled` (phones): whether the item may have a layout transition now (a list's rows once the screen has settled; a
 * board's cards while a card is in the air). The web has no custom layout transitions: there the box slides alone, by
 * the provider's signal, and `enabled` doesn't matter.
 */
export function useItemSlide(enabled: boolean) {
  const { itemLayout } = useReorder();
  const sliding = useReorderSliding();
  if (isWeb) return { box: sliding ? ITEM_LAYOUT : undefined, inner: undefined };
  return { box: enabled ? itemLayout : undefined, inner: enabled ? itemLayout : undefined };
}
