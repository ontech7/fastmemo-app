import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BackspaceIcon from "react-native-heroicons/outline/BackspaceIcon";

import { KEYPAD_COLUMN } from "@/constants/layout";
import { BORDER, COLOR, FONT, GLASS, SIZE } from "@/constants/styles";

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
        accessibilityRole="button"
      >
        <Text style={styles.keyboard_text} maxFontSizeMultiplier={DIGIT_MAX_FONT_SCALE}>
          {value}
        </Text>
      </Pressable>
    </View>
  );
});

const BackspaceKey = memo(function BackspaceKey({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { t } = useTranslation();

  return (
    <View style={styles.keyboard_input_wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("a11y.delete_digit")}
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

/** Digits are already large: past this a key can't hold them (a large system font). */
const DIGIT_MAX_FONT_SCALE = 1.2;
/** A key's height when there is room; less when there isn't (a large font or display size): the pad shrinks, never runs off. */
const KEY_HEIGHT = 80;

const styles = StyleSheet.create({
  keyboard_wrapper: {
    ...KEYPAD_COLUMN,
    flex: 1,
    maxHeight: KEY_HEIGHT * 4,
    borderTopLeftRadius: BORDER.normal,
    borderTopRightRadius: BORDER.normal,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  keyboard_input_wrapper: {
    width: SIZE.third,
    height: "25%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  keyboard_input: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.surface,
  },
  keyboard_input_pressed: {
    opacity: 0.7,
  },
  keyboard_text: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: 42,
  },
});

export default memo(VirtualNumberKeyboard);
