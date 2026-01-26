import React from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { BORDER, COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function BaseInput({ label, style = {}, ...props }) {
  return (
    <>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.container}>
        <TextInput
          cursorColor={COLOR.softWhite}
          placeholderTextColor={COLOR.placeholder}
          {...props}
          style={[styles.input, style]}
        />
      </View>
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
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: COLOR.gray,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: Platform.OS === "web" ? PADDING_MARGIN.md : 0,
  },
  label: {
    color: COLOR.softWhite,
    marginBottom: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.subtitle,
  },
});
