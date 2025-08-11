import React from "react";
import { TouchableOpacity } from "react-native";
import { Squares2X2Icon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

export default function GridSizeButton({ onChange, color = null }) {
  return (
    <TouchableOpacity onPress={onChange}>
      <Squares2X2Icon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}
