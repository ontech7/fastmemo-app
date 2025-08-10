import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronRightIcon } from "react-native-heroicons/outline";

import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function SectionItemList_Navigation({ title, extra = null, route = null, onPress = null }) {
  const router = useRouter();

  return (
    <TouchableOpacity style={styles.sectionItemList_button} onPress={onPress ?? (() => router.push(route))}>
      <View style={{ flexDirection: "row" }}>
        <Text style={styles.sectionItemList_title}>{title}</Text>

        {extra}
      </View>

      <ChevronRightIcon color={COLOR.lightBlue} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  sectionItemList_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.lightBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
  },
});
