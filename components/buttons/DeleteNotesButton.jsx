import React from "react";
import { TouchableOpacity } from "react-native";
import { TrashIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

export default function DeleteNotesButton({ onPressDelete, color = null }) {
  return (
    <TouchableOpacity onPress={onPressDelete}>
      <TrashIcon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}
