import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";

import { useRouter } from "@/hooks/useRouter";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

import type { Href } from "expo-router";

interface Props {
  title: string;
  extra?: React.ReactNode;
  route?: Href | null;
  onPress?: (() => void) | null;
}

export default function SectionItemList_Navigation({ title, extra = null, route = null, onPress = null }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.sectionItemList_button} onPress={onPress ?? (() => router.push(route))}>
      <View style={{ flexDirection: "row" }}>
        <Text style={styles.sectionItemList_title}>{title}</Text>

        {extra}
      </View>

      <ChevronRightIcon color={COLOR.textMuted} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  // The row (SectionItemList) pads its content by PADDING_MARGIN.lg: the pressable takes that padding back, so the whole
  // row answers a tap, edges included, and looks the same (LL-087).
  sectionItemList_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: -PADDING_MARGIN.lg,
    padding: PADDING_MARGIN.lg,
  },
  sectionItemList_title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
  },
});
