import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import React from "react";
import type { ViewStyle } from "react-native";
import { Keyboard, TouchableOpacity } from "react-native";
import { ChevronLeftIcon } from "react-native-heroicons/outline";

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
        Keyboard.dismiss();
        router.back();
      }}
    >
      <ChevronLeftIcon size={28} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}
