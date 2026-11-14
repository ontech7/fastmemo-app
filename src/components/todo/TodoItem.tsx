import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputKeyPressEvent,
  TouchableOpacity,
  View,
  type ViewInstance,
} from "react-native";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { haptic } from "@/libs/haptics";
import { DURATION, EASING, SPRING } from "@/constants/motion";

import ReorderHandle from "@/components/reorder/ReorderHandle";
import ReorderSlot from "@/components/reorder/ReorderSlot";
import { useItemSlide } from "@/components/reorder/useItemSlide";
import { useReorder } from "@/providers/ReorderProvider";

import DragIcon from "@/components/icons/DragIcon";

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
  autoFocus: boolean;
  // Forwarded to the row's text input so the parent can focus it imperatively
  // once the screen transition settles (mount-time autoFocus alone is dropped
  // mid-transition on native).
  inputRef?: RefObject<TextInputInstance | null>;
  stepMode?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isLast?: boolean;
  animationsReady?: boolean;
  /** Enter: a new item under this one. */
  addAfter?: (id: string) => void;
  /** Backspace in this item while it's empty. */
  removeEmpty?: (id: string) => void;
  /** Changes with each request for this row's focus (with `autoFocus`): the caret then goes to the end of its text. */
  focusSeq?: number;
}

/** The list's only container in the reorder engine. */
export const LIST_CONTAINER = "list";

/** One row for phones, the web and desktop: the same look everywhere. */
const isWeb = Platform.OS === "web";

const STEP_COLUMN_WIDTH = 50;
const STEP_CIRCLE_SIZE = 34;
/** A text field's line on the web, where the field is as high as its lines (it doesn't grow by itself there). */
const WEB_LINE = Math.round(FONTSIZE.inputTitle * 1.35);

// One instance of each animation for every row (a builder made per render is a new prop each time).
const ROW_LAYOUT = LinearTransition.springify().damping(SPRING.soft.damping).stiffness(SPRING.soft.stiffness);
const ROW_ENTERING = FadeIn.duration(DURATION.base);
const ROW_EXITING = FadeOut.duration(DURATION.fast);
const CHECK_ENTERING = FadeIn.duration(DURATION.base);
const CHECK_EXITING = FadeOut.duration(DURATION.fast);
const ONGOING_ENTERING = FadeIn.duration(DURATION.base);
const ONGOING_EXITING = FadeOut.duration(DURATION.fast);

function TodoItem({
  item,
  setText,
  checkItem,
  deleteItem,
  disabled,
  folded = false,
  slotHeight = 0,
  autoFocus,
  inputRef,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isLast = false,
  animationsReady = false,
  addAfter,
  removeEmpty,
  focusSeq = 0,
}: Props) {
  const { t } = useTranslation();

  const circleFill = useSharedValue(0);

  const isOngoing = stepMode && stepStatus === "ongoing";
  const isFuture = stepMode && stepStatus === "future";
  const isStepDone = stepMode && stepStatus === "done";

  useEffect(() => {
    circleFill.value = withTiming(isOngoing ? 1 : 0, {
      duration: DURATION.slow,
      easing: EASING.enter,
    });
  }, [isOngoing, circleFill]);

  // Measured by the reorder engine at lift only (free mode: steps have no handle).
  const { registerItem } = useReorder();
  // Once the screen has settled: layout transitions on rows mounting during it crash Reanimated (below).
  const slide = useItemSlide(animationsReady);
  // A multiline field grows with its text by itself on phones. On the web it is as high as its text, measured after each
  // change with its height let go first: a field never measures shorter than it is, so a line deleted kept it tall.
  const webInputRef = useRef<TextInputInstance>(null);
  const [webHeight, setWebHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!isWeb) return;
    const field = webInputRef.current as unknown as HTMLTextAreaElement | null;
    if (!field?.style) return;
    const height = field.style.height;
    field.style.height = "auto";
    // The text and the paddings, and the borders (the field's box includes them).
    const fits = field.scrollHeight + field.offsetHeight - field.clientHeight;
    field.style.height = height;
    setWebHeight(fits);
  }, [item.text, stepMode]);
  const fieldRef = isWeb ? webInputRef : inputRef;

  // A row asked for again (the one above an item removed with Backspace): the focus, and the caret at the end.
  useEffect(() => {
    if (!autoFocus || !focusSeq) return;
    const field = fieldRef?.current as (TextInputInstance & Partial<HTMLTextAreaElement>) | null | undefined;
    if (!field) return;
    field.focus();
    const end = item.text.length;
    if (isWeb) field.setSelectionRange?.(end, end);
    else field.setSelection?.(end, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq]);

  // Enter makes the next item (the text is never split): on the phone a submit, with no line break; on the web Enter
  // without Shift and outside a composition (Shift + Enter is a line break). Backspace in an empty item removes it.
  const onKeyPress = (e: TextInputKeyPressEvent) => {
    const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
    const cancel = () => (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    if (key.key === "Backspace" && item.text === "" && removeEmpty) {
      cancel();
      removeEmpty(item.id);
    } else if (isWeb && key.key === "Enter" && !key.shiftKey && !key.isComposing && key.keyCode !== 229 && addAfter) {
      cancel();
      addAfter(item.id);
    }
  };
  const keyProps = disabled
    ? {}
    : isWeb
      ? { onKeyPress }
      : { onKeyPress, submitBehavior: "submit" as const, onSubmitEditing: () => addAfter?.(item.id) };
  const webHeightStyle = webHeight !== undefined ? { height: webHeight } : undefined;
  const rowRef = useRef<ViewInstance>(null);
  useEffect(() => (stepMode ? undefined : registerItem(LIST_CONTAINER, item.id, rowRef)), [registerItem, item.id, stepMode]);

  const circleFillStyle = useAnimatedStyle(() => ({
    opacity: circleFill.value,
    transform: [{ scale: 0.6 + 0.4 * circleFill.value }],
  }));

  // A haptic for each row ticked or unticked (the box is disabled on a read-only list).
  const handleCheck = () => {
    haptic.select();
    checkItem(item.id);
  };

  // Root-level layout/entering/exiting animations are only enabled once the
  // screen navigation transition has settled. Running them while the screen is
  // still mounting crashes Reanimated with "Unable to find viewState for tag".
  const rowLayout = animationsReady ? ROW_LAYOUT : undefined;
  const rowEntering = animationsReady ? ROW_ENTERING : undefined;
  const rowExiting = animationsReady ? ROW_EXITING : undefined;

  /* FREE MODE -- checkbox + text + drag handle */

  if (!stepMode) {
    return (
      <Animated.View
        // The engine's slide (the slot opening, a place closing; none at the lift and the drop) is the row's own: one
        // transition that never changes, so a drag renders only the rows whose place or slot changes.
        layout={slide.box}
        entering={rowEntering}
        exiting={rowExiting}
        style={folded && styles.folded}
      >
        {slotHeight ? <ReorderSlot height={slotHeight} /> : null}
        {/* The row slides inside its box too: the slot opening above it or closing moves the row in the box while the
            box itself slides, and only the two together keep each row where it should be at every frame (a slot two
            places away drew the rows at the two ends jumping and the ones between sliding). */}
        <Animated.View ref={rowRef} layout={slide.inner} style={styles.row}>
          <View style={[styles.inner, item.checked && styles.innerChecked]}>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={disabled}
              style={styles.checkTouch}
              onPress={handleCheck}
              accessibilityRole="checkbox"
              accessibilityLabel={item.text || t("a11y.item")}
              aria-checked={item.checked}
            >
              <View style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked]}>
                {item.checked && (
                  <Animated.View entering={CHECK_ENTERING} exiting={CHECK_EXITING}>
                    <CheckIcon size={24} color={COLOR.softWhite} />
                  </Animated.View>
                )}
              </View>
            </TouchableOpacity>

            <TextInput
              ref={fieldRef}
              style={[
                styles.listItemInputFree,
                isWeb && styles.webInputFree,
                item.checked && styles.listItemInputChecked,
                isWeb && webHeightStyle,
              ]}
              textAlignVertical="center"
              multiline
              numberOfLines={isWeb ? 1 : undefined}
              scrollEnabled={!isWeb}
              onChangeText={(value) => setText(item.id, value)}
              value={item.text}
              editable={!disabled}
              cursorColor={COLOR.softWhite}
              autoFocus={autoFocus}
              {...keyProps}
            />

            <ReorderHandle item={item} containerId={LIST_CONTAINER} disabled={disabled} style={styles.drag} />
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={styles.deleteButton}
            onPress={() => deleteItem(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.delete_item")}
          >
            <View style={styles.deleteChip}>
              <TrashIcon size={16} color={COLOR.textMuted} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  }

  /* STEP MODE -- numbered circles + connector line + status on the right */

  const numberColor = isOngoing ? COLOR.softWhite : COLOR.textSecondary;
  const circleBorderColor = isOngoing ? COLOR.accentSoft : isStepDone ? COLOR.accentMutedBorder : GLASS.border;

  return (
    <Animated.View layout={rowLayout} entering={rowEntering} exiting={rowExiting} style={styles.stepRow}>
      {/* left rail: connector line + tappable numbered circle (checkbox) + Ongoing label */}

      <View style={styles.stepColumn}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={handleCheck}
          accessibilityRole="checkbox"
          accessibilityLabel={item.text || t("a11y.item")}
          aria-checked={isStepDone}
        >
          <View style={[styles.stepCircle, { borderColor: circleBorderColor }, isStepDone && styles.stepCircleDone]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.stepCircleFill, circleFillStyle]} />

            {isStepDone ? (
              <CheckIcon size={18} color={COLOR.softWhite} />
            ) : (
              <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={[styles.stepLine, isLast && styles.stepLineHidden]} />

        {isOngoing && (
          <Animated.View entering={ONGOING_ENTERING} exiting={ONGOING_EXITING} style={styles.stepOngoingLabelWrap}>
            <Text style={styles.stepOngoingLabel}>{t("note.ongoing")}</Text>
          </Animated.View>
        )}
      </View>

      {/* main text */}

      <View style={styles.stepTextWrap}>
        <TextInput
          ref={fieldRef}
          style={[
            styles.stepTextInput,
            item.checked && styles.stepTextDone,
            isFuture && styles.stepTextFuture,
            isWeb && styles.webStepText,
            isWeb && webHeightStyle,
          ]}
          textAlignVertical="center"
          multiline
          numberOfLines={isWeb ? 1 : undefined}
          scrollEnabled={!isWeb}
          onChangeText={(value) => setText(item.id, value)}
          value={item.text}
          editable={!disabled}
          cursorColor={COLOR.softWhite}
          autoFocus={autoFocus}
          {...keyProps}
        />
      </View>

      {/* delete */}

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        style={styles.stepDelete}
        onPress={() => deleteItem(item.id)}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.delete_item")}
      >
        <View style={styles.deleteChip}>
          <TrashIcon size={16} color={COLOR.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
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
    <View style={styles.row}>
      <View style={[styles.inner, styles.innerLifted, item.checked && styles.innerChecked]}>
        <View style={styles.checkTouch}>
          <View style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked, styles.edgeLifted]}>
            {item.checked && <CheckIcon size={24} color={COLOR.softWhite} />}
          </View>
        </View>
        {/* The row's own text field, read-only: it lays the text out exactly as the row does. */}
        <TextInput
          style={[
            styles.listItemInputFree,
            isWeb && styles.webInputFree,
            item.checked && styles.listItemInputChecked,
            styles.edgeLifted,
            height !== undefined && { height },
          ]}
          textAlignVertical="center"
          multiline
          scrollEnabled={false}
          editable={false}
          focusable={false}
          value={item.text}
          pointerEvents="none"
        />
        <View style={[styles.drag, styles.edgeLifted]}>
          <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
        </View>
      </View>
      <View style={styles.deleteButton}>
        <View style={styles.deleteChip}>
          <TrashIcon size={16} color={COLOR.textMuted} />
        </View>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  /* shared (free mode) */
  // Its place closed, the row still mounted: nothing of it shows or takes room.
  folded: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  row: {
    flexDirection: "row",
    marginBottom: PADDING_MARGIN.sm,
  },
  inner: {
    flex: 1,
    flexGrow: 1,
    flexDirection: "row",
  },
  innerChecked: {
    opacity: 0.55,
  },
  // In the air (the engine's layer): raised like a kanban card.
  innerLifted: {
    borderRadius: BORDER.normal,
    ...SHADOW.lifted,
  },
  edgeLifted: {
    borderColor: COLOR.accentSoft,
  },
  checkTouch: {
    marginRight: PADDING_MARGIN.sm,
  },
  listItemInputChecked: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  listItemInputFree: {
    minHeight: 48,
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  // The web can't centre a text field's text: one line of WEB_LINE between paddings and the borders (1 each) fills the
  // row's 48 as on phones.
  webInputFree: {
    lineHeight: WEB_LINE,
    paddingTop: (48 - 2 - WEB_LINE) / 2,
    paddingBottom: (48 - 2 - WEB_LINE) / 2,
  },
  checkboxFree: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxFreeChecked: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  drag: {
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
    backgroundColor: COLOR.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stepCircleDone: {
    backgroundColor: COLOR.accentMuted,
  },
  stepCircleFill: {
    pointerEvents: "none",
    backgroundColor: COLOR.accent,
    borderRadius: STEP_CIRCLE_SIZE / 2,
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
  stepTextInput: {
    minHeight: 38,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.small,
    borderWidth: 1,
    borderColor: GLASS.border,
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  webStepText: {
    lineHeight: WEB_LINE,
    paddingTop: (38 - 2 - WEB_LINE) / 2,
    paddingBottom: (38 - 2 - WEB_LINE) / 2,
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
  stepDelete: {
    alignSelf: "flex-start",
    marginTop: 2,
    marginLeft: PADDING_MARGIN.sm,
  },
  deleteButton: {
    alignSelf: "center",
    marginLeft: PADDING_MARGIN.sm,
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

export default memo(TodoItem);
