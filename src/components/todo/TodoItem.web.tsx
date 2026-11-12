import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type ViewInstance } from "react-native";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import DragIcon from "@/components/icons/DragIcon";
import ReorderHandle from "@/components/reorder/ReorderHandle";
import ReorderSlot, { ITEM_LAYOUT } from "@/components/reorder/ReorderSlot";
import { useReorder } from "@/providers/ReorderProvider";

interface TodoItemData {
  id: string;
  text: string;
  checked: boolean;
}

type StepStatus = "done" | "ongoing" | "future";

interface Props {
  item: TodoItemData;
  setText: (id: string, text: string) => void;
  checkItem: (id: string) => void;
  deleteItem: (id: string) => void;
  disabled: boolean;
  /** The row in the air (free mode): its place folds away while it stays mounted (its gesture is the one running). */
  folded?: boolean;
  /** The slot of the row in the air opens above this row, this high (inside its own box: the rows never change order). */
  slotHeight?: number;
  hidden?: boolean;
  autoFocus: boolean;
  stepMode?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isFirst?: boolean;
  isLast?: boolean;
  // Accepted for API parity with the native variant (no-op on web).
  animationsReady?: boolean;
}

/** The list's only container in the reorder engine. */
export const LIST_CONTAINER = "list";

const STEP_COLUMN_WIDTH = 50;
const STEP_CIRCLE_SIZE = 34;

function TodoItem({
  item,
  setText,
  checkItem,
  deleteItem,
  disabled,
  folded = false,
  slotHeight = 0,
  hidden = false,
  autoFocus,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isLast = false,
}: Props) {
  const { t } = useTranslation();
  const [height, setHeight] = useState(40);
  const [pressing, setPressing] = useState(false);

  // Measured by the reorder engine at lift only (free mode: steps have no handle).
  const { registerItem } = useReorder();
  const rowRef = useRef<ViewInstance>(null);
  useEffect(() => (stepMode ? undefined : registerItem(LIST_CONTAINER, item.id, rowRef)), [registerItem, item.id, stepMode]);

  const isOngoing = stepMode && stepStatus === "ongoing";
  const isFuture = stepMode && stepStatus === "future";
  const isStepDone = stepMode && stepStatus === "done";

  if (hidden && item.checked) {
    return null;
  }

  /* FREE MODE -- drag + checkbox + text */

  if (!stepMode) {
    return (
      <Animated.View layout={ITEM_LAYOUT} style={folded && styles.folded}>
        {slotHeight ? <ReorderSlot height={slotHeight} style={styles.slot} /> : null}
        <View ref={rowRef} style={[styles.todoItemContainer, item.checked && styles.todoItemChecked]}>
          <ReorderHandle item={item} containerId={LIST_CONTAINER} disabled={disabled} style={styles.handle} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => checkItem(item.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={item.text || t("a11y.item")}
            aria-checked={item.checked}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            disabled={disabled}
            style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked, pressing && styles.pressed]}
          >
            {item.checked && <CheckIcon size={24} color={COLOR.softWhite} />}
          </TouchableOpacity>

          <TextInput
            style={[styles.listItemInputFree, { height }, item.checked && styles.listItemInputChecked]}
            textAlignVertical="top"
            multiline
            scrollEnabled={false}
            value={item.text}
            onChangeText={(text) => setText(item.id, text)}
            editable={!disabled}
            placeholderTextColor={COLOR.textMuted}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => deleteItem(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.delete_item")}
            disabled={disabled}
            style={styles.deleteButton}
          >
            <View style={styles.deleteChip}>
              <TrashIcon size={16} color={COLOR.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  /* STEP MODE */

  const numberColor = isOngoing ? COLOR.softWhite : COLOR.textSecondary;
  const circleBorderColor = isOngoing ? COLOR.accentSoft : isStepDone ? COLOR.accentMutedBorder : GLASS.border;
  const circleFillBg = isOngoing ? COLOR.accent : isStepDone ? COLOR.accentMuted : COLOR.surface;

  return (
    <View>
      <View style={styles.stepRow}>
        <View style={styles.stepColumn}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => checkItem(item.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={item.text || t("a11y.item")}
            aria-checked={isStepDone}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            disabled={disabled}
            style={[
              styles.stepCircle,
              { borderColor: circleBorderColor, backgroundColor: circleFillBg },
              pressing && styles.pressed,
            ]}
          >
            {isStepDone ? (
              <CheckIcon size={18} color={COLOR.softWhite} />
            ) : (
              <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.stepLine, isLast && styles.stepLineHidden]} />

          {isOngoing && (
            <View style={styles.stepOngoingLabelWrap}>
              <Text style={styles.stepOngoingLabel}>{t("note.ongoing")}</Text>
            </View>
          )}
        </View>

        <View style={styles.stepTextWrap}>
          <TextInput
            style={[
              styles.stepTextInput,
              { height: Math.max(40, height) },
              item.checked && styles.stepTextDone,
              isFuture && styles.stepTextFuture,
            ]}
            textAlignVertical="top"
            multiline
            scrollEnabled={false}
            value={item.text}
            onChangeText={(text) => setText(item.id, text)}
            editable={!disabled}
            placeholderTextColor={COLOR.textMuted}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => deleteItem(item.id)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.delete_item")}
          disabled={disabled}
          style={[styles.deleteButton, styles.stepDeleteAlign]}
        >
          <View style={styles.deleteChip}>
            <TrashIcon size={16} color={COLOR.textMuted} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface TodoItemStaticProps {
  item: TodoItemData;
  /** The lifted row's measured height: drawn at exactly that size, it becomes the real row at the drop without a hop. */
  height?: number;
}

/** A free-mode row as the reorder engine's layer draws it in the air: read-only, raised (accent edge, shadow). */
export function TodoItemStatic({ item, height }: TodoItemStaticProps) {
  return (
    <View style={[styles.todoItemContainer, styles.liftedRow, item.checked && styles.todoItemChecked]}>
      <View style={styles.handle}>
        <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
      </View>
      <View style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked, styles.edgeLifted]}>
        {item.checked && <CheckIcon size={24} color={COLOR.softWhite} />}
      </View>
      {/* The row's own text field, read-only: it lays the text out exactly as the row does. */}
      <TextInput
        style={[
          styles.listItemInputFree,
          item.checked && styles.listItemInputChecked,
          styles.edgeLifted,
          height !== undefined && { height },
        ]}
        textAlignVertical="top"
        multiline
        scrollEnabled={false}
        editable={false}
        focusable={false}
        value={item.text}
        pointerEvents="none"
      />
      <View style={styles.deleteButton}>
        <View style={styles.deleteChip}>
          <TrashIcon size={16} color={COLOR.textMuted} />
        </View>
      </View>
    </View>
  );
}

/** The delete button (32, its padding) and the row's gap: the slot stops where the row's body does. */
const DELETE_SPAN = 32 + PADDING_MARGIN.xs * 2 + PADDING_MARGIN.sm;

const styles = StyleSheet.create({
  /* dragging */
  slot: {
    marginBottom: PADDING_MARGIN.sm,
    marginRight: DELETE_SPAN,
  },
  // Its place closed, the row still mounted: nothing of it shows or takes room.
  folded: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  handle: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  liftedRow: {
    marginBottom: 0,
    borderRadius: BORDER.normal,
    ...SHADOW.lifted,
  },
  edgeLifted: {
    borderColor: COLOR.accentSoft,
  },

  /* free mode */
  todoItemChecked: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.9 }],
  },
  listItemInputChecked: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  todoItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
    gap: PADDING_MARGIN.sm,
  },
  listItemInputFree: {
    minHeight: 40,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 3,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  checkboxFree: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    height: 40,
    width: 40,
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxFreeChecked: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  deleteButton: {
    alignSelf: "center",
    padding: PADDING_MARGIN.xs,
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

  /* step mode */
  stepRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 52,
  },
  stepColumn: {
    pointerEvents: "box-none",
    width: STEP_COLUMN_WIDTH,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  // Single connector below each circle; it flexes so the gap autogrows with the
  // entry height and stays continuous down to the next step's circle.
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 8,
    backgroundColor: GLASS.border,
  },
  stepLineHidden: {
    backgroundColor: "transparent",
  },
  stepCircle: {
    width: STEP_CIRCLE_SIZE,
    height: STEP_CIRCLE_SIZE,
    borderRadius: STEP_CIRCLE_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleNumber: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
  },
  stepOngoingLabelWrap: {
    pointerEvents: "none",
    position: "absolute",
    top: STEP_CIRCLE_SIZE + 6 + 4,
    left: -8,
    right: -8,
    alignItems: "center",
  },
  stepOngoingLabel: {
    color: COLOR.accentSoft,
    fontSize: FONTSIZE.small,
    fontFamily: FONT.semiBold,
    backgroundColor: COLOR.bg,
    paddingHorizontal: 4,
  },
  stepTextWrap: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  stepDeleteAlign: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  stepTextInput: {
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.small,
    borderWidth: 1,
    borderColor: GLASS.border,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  stepTextDone: {
    color: COLOR.textMuted,
    textDecorationLine: "line-through",
  },
  stepTextFuture: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    opacity: 0.95,
  },
});

export default memo(TodoItem);

/** The slot's margins in a list on the web: the row's body only (the delete button stays outside it). */
export const ROW_SLOT_STYLE = styles.slot;
