import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  title: string;
  text?: string | null;
  extra?: React.ReactNode;
  onPress: () => void;
}

export default function SectionItemList_Text({ title, text = null, extra = null, onPress }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.sectionItemList_button} onPress={onPress}>
      <View style={{ flexDirection: "row" }}>
        <Text style={styles.sectionItemList_title}>{title}</Text>

        {extra}
      </View>

      {text && <Text style={styles.sectionItemList_text}>{text}</Text>}
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
