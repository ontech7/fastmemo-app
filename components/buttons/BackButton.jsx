import React from "react";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { ChevronLeftIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

export default function BackButton({ callback = null, style = {} }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={style}
      onPress={() => {
        if (callback) callback();
        router.back();
      }}
    >
      <ChevronLeftIcon size={28} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}
