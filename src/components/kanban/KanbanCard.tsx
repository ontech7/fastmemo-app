import DragIcon from "@/components/icons/DragIcon";
import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
  type ViewInstance,
} from "react-native";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import ReorderHandle from "@/components/reorder/ReorderHandle";
import ReorderSlot, { ITEM_LAYOUT } from "@/components/reorder/ReorderSlot";
import { useReorder } from "@/providers/ReorderProvider";

import type { KanbanItem } from "@/types";

interface Props {
  item: KanbanItem;
  columnId: string;
  /** The board's handlers, passed through the column as they are (stable): a closure per card would render every card. */
  setText: (columnId: string, cardId: string, text: string) => void;
  deleteItem: (columnId: string, cardId: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
  // Forwarded to the card's text input so the board can focus it imperatively
  // once the screen transition settles (mount-time autoFocus alone is dropped
  // mid-transition on native).
  inputRef?: RefObject<TextInputInstance | null>;
  /** The card in the air: its place folds away while it stays mounted (its gesture is the one running). */
  folded?: boolean;
  /** A card is in the air: layout changes slide (the slot opening, a place closing). */
  animateLayout?: boolean;
  /**
   * The slot of the card in the air opens above this card, this high. Inside the card's own box: the column's children
   * never change order during a drag, which on the web would move the lifted card's node and end its gesture.
   */
  slotHeight?: number;
}

function KanbanCard({
  item,
  columnId,
  setText,
  deleteItem,
  disabled,
  autoFocus,
  inputRef,
  folded,
  animateLayout,
  slotHeight,
}: Props) {
  const { t } = useTranslation();

  const [height, setHeight] = useState(40);

  const { registerItem } = useReorder();

  // Measured by the engine at lift only.
  const rowRef = useRef<ViewInstance>(null);
  useEffect(() => registerItem(columnId, item.id, rowRef), [registerItem, columnId, item.id]);

  return (
    <Animated.View layout={animateLayout ? ITEM_LAYOUT : undefined} style={folded && styles.folded}>
      {slotHeight ? <ReorderSlot height={slotHeight} /> : null}
      <View ref={rowRef} style={styles.container}>
        <View style={styles.cardWrapper}>
          <View style={styles.cardContent}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { height }]}
              textAlignVertical="center"
              multiline
              scrollEnabled={false}
              onChangeText={(value) => setText(columnId, item.id, value)}
              value={item.text}
              editable={!disabled}
              placeholderTextColor={COLOR.textMuted}
              cursorColor={COLOR.softWhite}
              autoFocus={autoFocus}
              onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
            />

            <ReorderHandle item={item} containerId={columnId} disabled={disabled} style={styles.dragHandle} />
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={styles.deleteButton}
            onPress={() => deleteItem(columnId, item.id)}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.delete_item")}
          >
            <View style={styles.deleteChip}>
              <TrashIcon size={16} color={COLOR.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

export default memo(KanbanCard);

// static card component for the floating overlay (no gestures)
interface KanbanCardStaticProps {
  item: KanbanItem;
  /**
   * The lifted card's measured height: drawn at exactly that size, it becomes the real card at the drop without a hop
   * (its own layout would make it taller than a one-line card).
   */
  height?: number;
}

export function KanbanCardStatic({ item, height }: KanbanCardStaticProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.cardWrapper, styles.cardWrapperFloating]}>
        <View style={styles.cardContent}>
          {/* The card's own text field, read-only: it lays the text out exactly as the card does. */}
          <TextInput
            style={[styles.textInput, styles.floatingEdge, height !== undefined && { height }]}
            textAlignVertical="center"
            multiline
            scrollEnabled={false}
            editable={false}
            focusable={false}
            value={item.text}
            pointerEvents="none"
          />
          <View style={[styles.dragHandle, styles.floatingEdge]}>
            <DragIcon
              iconProps={{
                color: COLOR.textSecondary,
                opacity: 0.9,
              }}
            />
          </View>
        </View>
        <View style={styles.deleteButton}>
          <View style={styles.deleteChip}>
            <TrashIcon size={16} color={COLOR.textMuted} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginBottom: PADDING_MARGIN.sm,
  },
  // Its place closed, the card still mounted: nothing of it shows or takes room.
  folded: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  cardWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardWrapperFloating: {
    borderRadius: BORDER.normal,
    ...SHADOW.lifted,
  },
  // The lifted card's edge: one accent line around the text and the handle.
  floatingEdge: {
    borderColor: COLOR.accentSoft,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
  },
  textInput: {
    minHeight: 44,
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: GLASS.border,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: GLASS.border,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
  },
  deleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    alignSelf: "center",
  },
  deleteChip: {
    width: 32,
    height: 32,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
});
