import React from "react";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { XMarkIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

export default function CloseButton({ callback = null, style = {} }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={style}
      activeOpacity={0.7}
      onPress={() => {
        if (callback) callback();
        router.back();
      }}
    >
      <XMarkIcon size={28} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}
