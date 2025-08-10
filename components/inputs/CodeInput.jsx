import React, { useCallback, useEffect } from "react";
import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from "expo-haptics";
import { StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import VirtualNumberKeyboard from "../VirtualNumberKeyboard";

const unify = (array) => array.join("");
const separate = (string) => string.split("");

export default function CodeInput({ value, onChangeCode, onSubmit, disabled }) {
  const code = separate(value);
  const is_code_empty = code.length == 0;
  const is_code_set = code.length == 4;

  const addNumberWithVibration = useCallback(
    (number) => () => {
      if (is_code_set) {
        return;
      }

      const codeUpdated = [...code, number];

      onChangeCode(unify(codeUpdated));
      impactAsync(ImpactFeedbackStyle.Light);
    },
    [code]
  );

  const removeNumberWithVibration = useCallback(() => {
    if (is_code_empty) {
      return;
    }

    let codeUpdated = [...code];
    codeUpdated.pop();

    onChangeCode(unify(codeUpdated));
    notificationAsync(NotificationFeedbackType.Error);
  }, [code]);

  useEffect(() => {
    if (!is_code_set) {
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
