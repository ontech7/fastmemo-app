import React from "react";
import { TouchableOpacity } from "react-native";
import { TrashIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

interface Props {
  onPressDelete: () => void;
  color?: string | null;
}

export default function DeleteNotesButton({ onPressDelete, color = null }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPressDelete}>
      <TrashIcon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}
