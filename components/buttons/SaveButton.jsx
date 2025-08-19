import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function SaveButton({ onPress, color = null }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.addBtn} onPress={onPress}>
      <CheckIcon size={28} color={color || COLOR.black} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    position: "absolute",
    bottom: 40,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
