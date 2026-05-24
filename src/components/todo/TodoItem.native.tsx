import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, XCircleIcon } from "react-native-heroicons/outline";
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

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

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
  hidden: boolean;
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
  hidden,
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

  /* FREE MODE -- unchanged classic layout */

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
            <Animated.View style={[styles.checkboxFree, checkboxAnimatedStyle]}>
              {item.checked && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                  <CheckIcon size={28} color={COLOR.softWhite} style={{ margin: 7 }} />
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
            <DragIcon iconProps={{ color: COLOR.softWhite, opacity: 0.75 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={{ marginLeft: PADDING_MARGIN.sm }}
          onPress={() => deleteItem(item.id)}
        >
          <XCircleIcon size={28} color={COLOR.softWhite} style={{ marginVertical: 8 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* STEP MODE -- numbered circles + connector line + status on the right */

  const numberColor = isOngoing ? COLOR.darkBlue : isStepDone ? COLOR.lightBlue : COLOR.softWhite;
  const circleBorderColor = isOngoing ? COLOR.oceanBreeze : isStepDone ? COLOR.lightBlue : COLOR.softWhite;

  return (
    <Animated.View layout={rowLayout} entering={rowEntering} exiting={rowExiting} style={styles.stepRow}>
      {/* left rail: connector line + numbered circle + Ongoing label */}

      <View style={styles.stepColumn} pointerEvents="box-none">
        <View style={[styles.stepLine, isFirst && styles.stepLineHidden]} />

        <View style={[styles.stepCircle, { borderColor: circleBorderColor }]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.stepCircleFill, circleFillStyle]} />

          <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
        </View>

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

      {/* status checkbox (right) */}

      <TouchableOpacity activeOpacity={0.7} disabled={disabled || isFuture} onPress={handleCheck} style={styles.stepStatusWrap}>
        <Animated.View
          style={[
            styles.stepStatusBox,
            item.checked && styles.stepStatusBoxDone,
            isOngoing && styles.stepStatusBoxOngoing,
            checkboxAnimatedStyle,
          ]}
        >
          {item.checked && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
              <CheckIcon size={20} color={COLOR.softWhite} />
            </Animated.View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* delete */}

      <TouchableOpacity activeOpacity={0.7} disabled={disabled} style={styles.stepDelete} onPress={() => deleteItem(item.id)}>
        <XCircleIcon size={24} color={COLOR.softWhite} />
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
    paddingVertical: PADDING_MARGIN.sm - 4,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkboxFree: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  drag: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 2,
    borderRightColor: COLOR.boldBlue,
    borderTopWidth: 2,
    borderTopColor: COLOR.boldBlue,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.boldBlue,
    borderLeftWidth: 1,
    borderLeftColor: COLOR.darkBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
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
    backgroundColor: COLOR.boldBlue,
  },
  stepLineHidden: {
    backgroundColor: "transparent",
  },
  stepCircle: {
    width: STEP_CIRCLE_SIZE,
    height: STEP_CIRCLE_SIZE,
    borderRadius: STEP_CIRCLE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: COLOR.darkBlue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stepCircleFill: {
    backgroundColor: COLOR.oceanBreeze,
    borderRadius: STEP_CIRCLE_SIZE / 2,
  },
  stepCircleNumber: {
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
  stepOngoingLabelWrap: {
    position: "absolute",
    top: STEP_CIRCLE_SIZE + 6 + 4,
    left: -8,
    right: -8,
    alignItems: "center",
  },
  stepOngoingLabel: {
    color: COLOR.oceanBreeze,
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.semiBold,
    backgroundColor: COLOR.darkBlue,
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
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.small,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  stepTextDone: {
    color: COLOR.lightBlue,
    textDecorationLine: "line-through",
  },
  stepTextFuture: {
    color: COLOR.softWhite,
    fontWeight: FONTWEIGHT.regular,
    opacity: 0.95,
  },
  stepStatusWrap: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepStatusBox: {
    width: 38,
    height: 38,
    borderRadius: BORDER.small,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    backgroundColor: COLOR.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  stepStatusBoxOngoing: {
    borderColor: COLOR.oceanBreeze,
  },
  stepStatusBoxDone: {
    borderColor: COLOR.oceanBreeze,
    backgroundColor: COLOR.darkOceanBreeze,
  },
  stepDelete: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
