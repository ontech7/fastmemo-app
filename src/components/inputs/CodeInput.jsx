import React, { useCallback, useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import Haptics from "@/libs/haptics";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import VirtualNumberKeyboard from "../VirtualNumberKeyboard";

const unify = (array) => array.join("");
const separate = (string) => string.split("");

export default function CodeInput({ value, onChangeCode, onSubmit, disabled }) {
  const code = separate(value);

  const isCodeEmpty = code.length == 0;
  const isCodeSet = code.length == 4;

  const addNumberWithVibration = useCallback(
    (number) => {
      if (isCodeSet) {
        return;
      }

      const codeUpdated = [...code, number];

      onChangeCode(unify(codeUpdated));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [code]
  );

  const removeNumberWithVibration = useCallback(() => {
    if (isCodeEmpty) {
      return;
    }

    let codeUpdated = [...code];
    codeUpdated.pop();

    onChangeCode(unify(codeUpdated));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [code]);

  useEffect(() => {
    if (Platform.OS !== "web" || disabled) return;

    const handleKeyDown = (e) => {
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
    if (!isCodeSet) {
      return;
    }
    onSubmit && onSubmit(value);
  }, [code]);

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
