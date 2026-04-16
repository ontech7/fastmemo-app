import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { EyeSlashIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressHidden: () => void;
}

export default function HiddenNotesButton({ onPressHidden }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.hiddenNoteButton} onPress={onPressHidden}>
      <EyeSlashIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  hiddenNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
