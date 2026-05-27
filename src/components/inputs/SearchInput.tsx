import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONT, PADDING_MARGIN } from "@/constants/styles";
import GlassSurface from "@/components/ui/GlassSurface";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Leading icon shown while the field is empty. Defaults to a magnifying glass. */
  icon?: ReactNode;
  /** Extra behavior to run when the clear (✕) button is pressed. */
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function SearchInput({ value, onChangeText, placeholder, icon, onClear, containerStyle }: Props) {
  const handleClear = () => {
    onChangeText("");
    Keyboard.dismiss();
    onClear?.();
  };

  return (
    <GlassSurface radius={BORDER.big} style={[styles.container, containerStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        cursorColor={COLOR.softWhite}
        placeholder={placeholder}
        placeholderTextColor={COLOR.placeholder}
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      {!value ? (
        <View style={styles.icon}>{icon ?? <MagnifyingGlassIcon size={18} color={COLOR.softWhite} />}</View>
      ) : (
        <Pressable style={styles.icon} hitSlop={8} onPress={handleClear}>
          <XMarkIcon size={18} color={COLOR.softWhite} />
        </Pressable>
      )}
    </GlassSurface>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
    marginBottom: PADDING_MARGIN.lg,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    color: COLOR.gray,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
  },
  icon: {
    marginRight: PADDING_MARGIN.xs,
  },
});
