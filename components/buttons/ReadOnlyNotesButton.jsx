import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { BookOpenIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function ReadOnlyNotesButton({ onPressReadOnly }) {
  return (
    <TouchableOpacity style={styles.readOnlyNoteButton} onPress={onPressReadOnly}>
      <BookOpenIcon size={16} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  readOnlyNoteButton: {
    padding: PADDING_MARGIN.md,
  },
});
