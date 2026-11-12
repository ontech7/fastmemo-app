import { memo, useEffect, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, TextInput, type TextInputInstance, TouchableOpacity, View } from "react-native";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, LIFT, PADDING_MARGIN, SHADOW } from "@/constants/styles";

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
  drag: () => void;
  /** Being dragged: it lifts like a kanban card (tilt, scale, accent edge, shadow). */
  lifted?: boolean;
  disabled: boolean;
  hidden?: boolean;
  autoFocus: boolean;
  // Forwarded to the row's text input so the parent can focus it imperatively
  // once the screen transition settles (mount-time autoFocus alone is dropped
  // mid-transition on native).
  inputRef?: RefObject<TextInputInstance | null>;
  stepMode?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isFirst?: boolean;
  isLast?: boolean;
  animationsReady?: boolean;
}

const STEP_COLUMN_WIDTH = 50;
const STEP_CIRCLE_SIZE = 34;

// One instance of each animation for every row (a builder made per render is a new prop each time).
const ROW_LAYOUT = LinearTransition.springify().damping(18).stiffness(180);
const ROW_ENTERING = FadeIn.duration(220);
const ROW_EXITING = FadeOut.duration(180);
const CHECK_ENTERING = FadeIn.duration(180);
const CHECK_EXITING = FadeOut.duration(120);
const ONGOING_ENTERING = FadeIn.duration(220);
const ONGOING_EXITING = FadeOut.duration(150);

function TodoItem({
  item,
  setText,
  checkItem,
  deleteItem,
  drag,
  lifted = false,
  disabled,
  hidden = false,
  autoFocus,
  inputRef,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isLast = false,
  animationsReady = false,
}: Props) {
  const { t } = useTranslation();

  const circleFill = useSharedValue(0);

  const isOngoing = stepMode && stepStatus === "ongoing";
  const isFuture = stepMode && stepStatus === "future";
  const isStepDone = stepMode && stepStatus === "done";

  useEffect(() => {
    circleFill.value = withTiming(isOngoing ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOngoing, circleFill]);

  // 0 flat, 1 lifted.
  const reducedMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    const to = lifted ? 1 : 0;
    lift.set(reducedMotion ? to : withTiming(to, { duration: lifted ? LIFT.ms : LIFT.settleMs }));
  }, [lifted, reducedMotion, lift]);
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${LIFT.tilt * lift.get()}deg` }, { scale: 1 + (LIFT.scale - 1) * lift.get() }] as const,
  }));

  const circleFillStyle = useAnimatedStyle(() => ({
    opacity: circleFill.value,
    transform: [{ scale: 0.6 + 0.4 * circleFill.value }],
  }));

  const handleCheck = () => {
    checkItem(item.id);
  };

  if (hidden && item.checked) {
    return null;
  }

  // Root-level layout/entering/exiting animations are only enabled once the
  // screen navigation transition has settled. Running them while the screen is
  // still mounting crashes Reanimated with "Unable to find viewState for tag".
  const rowLayout = animationsReady ? ROW_LAYOUT : undefined;
  const rowEntering = animationsReady ? ROW_ENTERING : undefined;
  const rowExiting = animationsReady ? ROW_EXITING : undefined;

  /* FREE MODE -- checkbox + text + drag handle */

  if (!stepMode) {
    return (
      <Animated.View layout={rowLayout} entering={rowEntering} exiting={rowExiting} style={styles.row}>
        <Animated.View style={[styles.inner, item.checked && styles.innerChecked, lifted && styles.innerLifted, liftStyle]}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={styles.checkTouch}
            onPress={handleCheck}
            accessibilityRole="checkbox"
            accessibilityLabel={item.text || t("a11y.item")}
            aria-checked={item.checked}
          >
            <View style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked, lifted && styles.edgeLifted]}>
              {item.checked && (
                <Animated.View entering={CHECK_ENTERING} exiting={CHECK_EXITING}>
                  <CheckIcon size={24} color={COLOR.softWhite} />
                </Animated.View>
              )}
            </View>
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.listItemInputFree, item.checked && styles.listItemInputChecked, lifted && styles.edgeLifted]}
            textAlignVertical="center"
            multiline
            onChangeText={(value) => setText(item.id, value)}
            value={item.text}
            editable={!disabled}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus}
          />

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={[styles.drag, lifted && styles.edgeLifted]}
            onPressIn={drag}
            // A drag starts on touch-down, which a screen reader's double tap can't drive
            accessible={false}
          >
            <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
          </TouchableOpacity>
        </Animated.View>

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
          ref={inputRef}
          style={[styles.stepTextInput, item.checked && styles.stepTextDone, isFuture && styles.stepTextFuture]}
          textAlignVertical="center"
          multiline
          onChangeText={(value) => setText(item.id, value)}
          value={item.text}
          editable={!disabled}
          cursorColor={COLOR.softWhite}
          autoFocus={autoFocus}
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

/* STYLES */

const styles = StyleSheet.create({
  /* shared (free mode) */
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
  // Being dragged: raised like a kanban card in the air.
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
