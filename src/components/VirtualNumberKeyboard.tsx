import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackspaceIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTWEIGHT, SIZE } from "@/constants/styles";

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "backspace"] as const;

interface Props {
  onAdd: (num: number | string) => void;
  onRemove: () => void;
  disabled: boolean;
}

const NumberKey = memo(function NumberKey({
  value,
  onPress,
  disabled,
}: {
  value: number;
  onPress: (num: number) => void;
  disabled: boolean;
}) {
  const handlePress = useCallback(() => {
    onPress(value);
  }, [value, onPress]);

  return (
    <View style={styles.keyboard_input_wrapper}>
      <Pressable
        style={({ pressed }) => [styles.keyboard_input, pressed && styles.keyboard_input_pressed]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text style={styles.keyboard_text}>{value}</Text>
      </Pressable>
    </View>
  );
});

const BackspaceKey = memo(function BackspaceKey({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <View style={styles.keyboard_input_wrapper}>
      <Pressable
        style={({ pressed }) => [styles.keyboard_input, pressed && styles.keyboard_input_pressed]}
        onPress={onPress}
        disabled={disabled}
      >
        <BackspaceIcon size={38} color={COLOR.softWhite} />
      </Pressable>
    </View>
  );
});

const EmptyKey = memo(function EmptyKey() {
  return (
    <View style={styles.keyboard_input_wrapper}>
      <View style={styles.keyboard_input} />
    </View>
  );
});

function VirtualNumberKeyboard({ onAdd, onRemove, disabled }: Props) {
  return (
    <View style={styles.keyboard_wrapper}>
      {numbers.map((num, index) =>
        num === "backspace" ? (
          <BackspaceKey key={index} onPress={onRemove} disabled={disabled} />
        ) : num === "" ? (
          <EmptyKey key={index} />
        ) : (
          <NumberKey key={index} value={num} onPress={onAdd} disabled={disabled} />
        )
      )}
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
  keyboard_input_pressed: {
    opacity: 0.7,
  },
  keyboard_text: {
    color: COLOR.softWhite,
    fontWeight: FONTWEIGHT.semiBold,
    fontSize: 42,
  },
});

export default memo(VirtualNumberKeyboard);
