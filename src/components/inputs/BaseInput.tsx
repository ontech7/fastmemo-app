import { StyleSheet, Text, TextInput, TextInputProps } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { BORDER, COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

interface Props extends TextInputProps {
  label?: string | null;
}

export default function BaseInput({ label = null, style = {}, ...props }: Props) {
  return (
    <>
      {label && <Text style={styles.label}>{label}</Text>}

      <GlassSurface radius={BORDER.big} style={styles.container}>
        <TextInput
          cursorColor={COLOR.softWhite}
          placeholderTextColor={COLOR.textMuted}
          {...props}
          style={[styles.input, style]}
        />
      </GlassSurface>
    </>
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
  input: {
    flex: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
  },
  label: {
    color: COLOR.textPrimary,
    marginBottom: PADDING_MARGIN.sm,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    letterSpacing: -0.2,
  },
});
