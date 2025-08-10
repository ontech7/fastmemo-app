import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { KeyIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function ProtectNotesButton({ onPressProtect }) {
  return (
    <TouchableOpacity style={styles.protectNoteButton} onPress={onPressProtect}>
      <KeyIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  protectNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
