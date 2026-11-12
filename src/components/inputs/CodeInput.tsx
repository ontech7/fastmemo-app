import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import Haptics from "@/libs/haptics";

import { DURATION } from "@/constants/motion";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import VirtualNumberKeyboard from "@/components/VirtualNumberKeyboard";

const separate = (string: string) => string.split("");

/** A digit typed: its dot pops in, short and without a bounce (a spring read as too much at every key). */
const DOT_IN = ZoomIn.duration(DURATION.fast);
/** A wrong code: the row shakes, -8, 8, -6, 6, 0 over `DURATION.slow`. */
const SHAKE = [-8, 8, -6, 6, 0];
const SHAKE_STEP = { duration: DURATION.slow / SHAKE.length };

interface Props {
  value: string;
  onChangeCode: (code: string) => void;
  onSubmit?: (value: string) => void;
  disabled: boolean;
  /** The code was wrong: the dots shake (not with reduced motion; the screen's error text says it either way). */
  error?: boolean;
}

export default function CodeInput({ value, onChangeCode, onSubmit, disabled, error = false }: Props) {
  const code = separate(value);

  const isCodeSet = code.length == 4;

  // Refs to keep callbacks stable across renders
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeCodeRef = useRef(onChangeCode);
  onChangeCodeRef.current = onChangeCode;

  const addNumberWithVibration = useCallback((number: number | string) => {
    const currentValue = valueRef.current;
    if (currentValue.length >= 4) return;
    onChangeCodeRef.current(currentValue + String(number));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const removeNumberWithVibration = useCallback(() => {
    const currentValue = valueRef.current;
    if (currentValue.length === 0) return;
    onChangeCodeRef.current(currentValue.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        addNumberWithVibration(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        // Drive the code input — and swallow the WebView's default Backspace
        // history navigation so it deletes a digit instead of going back.
        e.preventDefault();
        removeNumberWithVibration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addNumberWithVibration, removeNumberWithVibration, disabled]);

  const reduceMotion = useReducedMotion();
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (!error || reduceMotion) return;
    shakeX.value = withSequence(...SHAKE.map((x) => withTiming(x, SHAKE_STEP)));
  }, [error, reduceMotion, shakeX]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  useEffect(() => {
    if (value.length !== 4) return;
    onSubmit?.(value);
  }, [value]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, shakeStyle]}>
        {CELLS.map((cell) => (
          <View key={cell} style={styles.numberInput}>
            {code[cell] ? (
              <Animated.Text entering={DOT_IN} style={styles.dot}>
                •
              </Animated.Text>
            ) : null}
          </View>
        ))}
      </Animated.View>

      <VirtualNumberKeyboard onAdd={addNumberWithVibration} onRemove={removeNumberWithVibration} disabled={disabled} />
    </View>
  );
}

/* STYLES */

const CELLS = [0, 1, 2, 3];

const styles = StyleSheet.create({
  // At most 80% of the screen's area, less when the text above it needs the room (a large system font): it never pushes
  // that text over the screen's title.
  container: {
    flex: 1,
    maxHeight: "80%",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  numberInput: {
    marginHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.normal,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    width: 55,
    height: 70,
  },
  dot: {
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.title,
    textAlign: "center",
  },
});
