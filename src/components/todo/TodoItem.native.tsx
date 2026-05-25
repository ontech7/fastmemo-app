import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, TrashIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

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
  disabled: boolean;
  hidden?: boolean;
  autoFocus: boolean;
  stepMode?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isFirst?: boolean;
  isLast?: boolean;
  animationsReady?: boolean;
}

const STEP_COLUMN_WIDTH = 50;
const STEP_CIRCLE_SIZE = 34;

export default function TodoItem({
  item,
  setText,
  checkItem,
  deleteItem,
  drag,
  disabled,
  hidden = false,
  autoFocus,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isFirst = false,
  isLast = false,
  animationsReady = false,
}: Props) {
  const { t } = useTranslation();

  const checkScale = useSharedValue(1);
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

  const checkboxAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const circleFillStyle = useAnimatedStyle(() => ({
    opacity: circleFill.value,
    transform: [{ scale: 0.6 + 0.4 * circleFill.value }],
  }));

  const handleCheck = () => {
    checkScale.value = withSequence(
      withTiming(0.82, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 8, stiffness: 220 })
    );
    checkItem(item.id);
  };

  if (hidden && item.checked) {
    return null;
  }

  // Root-level layout/entering/exiting animations are only enabled once the
  // screen navigation transition has settled. Running them while the screen is
  // still mounting crashes Reanimated with "Unable to find viewState for tag".
  const rowLayout = animationsReady ? LinearTransition.springify().damping(18).stiffness(180) : undefined;
  const rowEntering = animationsReady ? FadeIn.duration(220) : undefined;
  const rowExiting = animationsReady ? FadeOut.duration(180) : undefined;

  /* FREE MODE -- checkbox + text + drag handle */

  if (!stepMode) {
    return (
      <Animated.View layout={rowLayout} entering={rowEntering} exiting={rowExiting} style={styles.row}>
        <View style={[styles.inner, { opacity: item.checked ? 0.55 : 1 }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={{ marginRight: PADDING_MARGIN.sm }}
            onPress={handleCheck}
          >
            <Animated.View style={[styles.checkboxFree, item.checked && styles.checkboxFreeChecked, checkboxAnimatedStyle]}>
              {item.checked && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                  <CheckIcon size={24} color={COLOR.softWhite} />
                </Animated.View>
              )}
            </Animated.View>
          </TouchableOpacity>

          <TextInput
            style={[styles.listItemInputFree, item.checked && { textDecorationLine: "line-through", opacity: 0.5 }]}
            textAlignVertical="center"
            multiline
            onChangeText={(value) => setText(item.id, value)}
            value={item.text}
            editable={!disabled}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus}
          />

          <TouchableOpacity activeOpacity={0.7} disabled={disabled} style={styles.drag} onPressIn={drag}>
            <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.deleteButton}
          onPress={() => deleteItem(item.id)}
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

      <View style={styles.stepColumn} pointerEvents="box-none">
        <View style={[styles.stepLine, isFirst && styles.stepLineHidden]} />

        <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={handleCheck}>
          <Animated.View
            style={[
              styles.stepCircle,
              { borderColor: circleBorderColor },
              isStepDone && styles.stepCircleDone,
              checkboxAnimatedStyle,
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, styles.stepCircleFill, circleFillStyle]}
            />

            {isStepDone ? (
              <CheckIcon size={18} color={COLOR.softWhite} />
            ) : (
              <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
            )}
          </Animated.View>
        </TouchableOpacity>

        <View style={[styles.stepLine, isLast && styles.stepLineHidden]} />

        {isOngoing && (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
            style={styles.stepOngoingLabelWrap}
            pointerEvents="none"
          >
            <Text style={styles.stepOngoingLabel}>{t("note.ongoing")}</Text>
          </Animated.View>
        )}
      </View>

      {/* main text */}

      <View style={styles.stepTextWrap}>
        <TextInput
          style={[styles.stepTextInput, item.checked && styles.stepTextDone, isFuture && styles.stepTextFuture]}
          textAlignVertical="center"
          multiline
          onChangeText={(value) => setText(item.id, value)}
          value={item.text}
          editable={!disabled}
          cursorColor={COLOR.softWhite}
          autoFocus={autoFocus && isOngoing}
        />
      </View>

      {/* delete */}

      <TouchableOpacity activeOpacity={0.7} disabled={disabled} style={styles.stepDelete} onPress={() => deleteItem(item.id)}>
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
    minHeight: 60,
  },
  stepColumn: {
    width: STEP_COLUMN_WIDTH,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 6,
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
    backgroundColor: COLOR.accent,
    borderRadius: STEP_CIRCLE_SIZE / 2,
  },
  stepCircleNumber: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
  },
  stepOngoingLabelWrap: {
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
    justifyContent: "center",
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
    alignSelf: "center",
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
