import { StyleSheet, TouchableOpacity } from "react-native";
import { ArrowPathIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressRestore: () => void;
  color?: string | null;
}

export default function RestoreNotesButton({ onPressRestore, color = null }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.restoreNoteButton} onPress={onPressRestore}>
      <ArrowPathIcon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  restoreNoteButton: { marginRight: PADDING_MARGIN.md },
});
