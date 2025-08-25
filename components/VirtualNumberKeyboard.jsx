import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BackspaceIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTWEIGHT, SIZE } from "@/constants/styles";

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "backspace"];

function VirtualNumberKeyboard({ onAdd, onRemove, disabled }) {
  return (
    <View style={styles.keyboard_wrapper}>
      {numbers.map((num, index) => (
        <View key={index} style={styles.keyboard_input_wrapper}>
          {num === "backspace" ? (
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.keyboard_input}
              onPress={onRemove}
              disabled={disabled}
            >
              <BackspaceIcon size={38} color={COLOR.softWhite} />
            </TouchableOpacity>
          ) : num === "" ? (
            <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.keyboard_input} disabled>
              <Text style={styles.keyboard_text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.keyboard_input}
              onPress={() => onAdd(num)}
              disabled={disabled}
            >
              <Text style={styles.keyboard_text}>{num}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard_wrapper: {
    borderTopLeftRadius: BORDER.normal,
    borderTopRightRadius: BORDER.normal,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  keyboard_input_wrapper: {
    width: SIZE.third,
    height: 80,
    borderWidth: 0.5,
    borderColor: COLOR.darkBlue,
  },
  keyboard_input: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.blue,
  },
  keyboard_text: {
    color: COLOR.softWhite,
    fontWeight: FONTWEIGHT.semiBold,
    fontSize: 42,
  },
});

export default memo(VirtualNumberKeyboard);
