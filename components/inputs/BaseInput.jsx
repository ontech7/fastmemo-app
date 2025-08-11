import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { BORDER, COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function BaseInput({ label, ...props }) {
  return (
    <>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.container}>
        <TextInput style={styles.input} {...props} cursorColor={COLOR.softWhite} placeholderTextColor={COLOR.placeholder} />
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
  },
  label: {
    color: COLOR.softWhite,
    marginBottom: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.subtitle,
  },
});
