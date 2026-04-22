import { StyleSheet, TouchableOpacity } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  onPress: () => void;
  color?: string | null;
}

export default function SaveButton({ onPress, color = null }: Props) {
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
    bottom: 60,
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
