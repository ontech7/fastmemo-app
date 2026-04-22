import { StyleSheet, TouchableOpacity } from "react-native";
import { KeyIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPressProtect: () => void;
}

export default function ProtectNotesButton({ onPressProtect }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.protectNoteButton} onPress={onPressProtect}>
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
