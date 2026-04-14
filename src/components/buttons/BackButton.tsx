import React from "react";
import { TouchableOpacity } from "react-native";
import { ChevronLeftIcon } from "react-native-heroicons/outline";

import { useRouter } from "@/hooks/useRouter";

import { COLOR } from "@/constants/styles";

import type { ViewStyle } from "react-native";

interface Props {
  callback?: (() => void) | null;
  style?: ViewStyle;
}

export default function BackButton({ callback = null, style = {} }: Props) {
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
      <ChevronLeftIcon size={28} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}
