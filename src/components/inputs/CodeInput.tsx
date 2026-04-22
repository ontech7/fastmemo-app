import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import Haptics from "@/libs/haptics";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import VirtualNumberKeyboard from "../VirtualNumberKeyboard";

const separate = (string: string) => string.split("");

interface Props {
  value: string;
  onChangeCode: (code: string) => void;
  onSubmit?: (value: string) => void;
  disabled: boolean;
}

export default function CodeInput({ value, onChangeCode, onSubmit, disabled }: Props) {
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
        removeNumberWithVibration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addNumberWithVibration, removeNumberWithVibration, disabled]);

  useEffect(() => {
    if (value.length !== 4) return;
    onSubmit?.(value);
  }, [value]);

  return (
    <View
      style={{
        height: "80%",
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        <Text style={styles.numberInput}>{code?.[0] ?? ""}</Text>

        <Text style={styles.numberInput}>{code?.[1] ?? ""}</Text>

        <Text style={styles.numberInput}>{code?.[2] ?? ""}</Text>

        <Text style={styles.numberInput}>{code?.[3] ?? ""}</Text>
      </View>

      <VirtualNumberKeyboard onAdd={addNumberWithVibration} onRemove={removeNumberWithVibration} disabled={disabled} />
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  numberInput: {
    marginHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.softWhite,
    padding: PADDING_MARGIN.md,
    fontWeight: FONTWEIGHT.semiBold,
    fontSize: FONTSIZE.title,
    borderRadius: BORDER.normal,
    overflow: "hidden",
    textAlign: "center",
    width: 55,
    height: 70,
  },
});
