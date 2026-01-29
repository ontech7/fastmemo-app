import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { StarIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function FavoriteNotesButton({ onPressSave }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.saveNoteButton} onPress={onPressSave}>
      <StarIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  saveNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
