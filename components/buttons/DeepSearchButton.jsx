import React from "react";
import { TouchableOpacity } from "react-native";
import { DocumentMagnifyingGlassIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

export default function DeepSearchButton({ onPress, color = null }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <DocumentMagnifyingGlassIcon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}
