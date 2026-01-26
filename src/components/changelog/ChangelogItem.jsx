import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function ChangelogItem({ version, text, isFirst, isLast }) {
  return (
    <View style={styles.container}>
      <View style={styles.dotLine_wrapper}>
        <View style={[styles.dot, isFirst && { backgroundColor: COLOR.darkYellow }]} />

        {!isLast && <View style={styles.line} />}
      </View>

      <View style={[styles.changelog_wrapper, !isFirst && { opacity: 0.7 }]}>
        <View style={styles.triangle} />

        <Text style={styles.version}>{version}</Text>

        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.xl,
  },
  dotLine_wrapper: {
    width: 45,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.lightGray,
    marginTop: PADDING_MARGIN.md + 2,
  },
  line: {
    marginTop: -1,
    marginLeft: 7,
    marginBottom: -60,
    width: 2,
    flexGrow: 1,
    backgroundColor: COLOR.lightGray,
  },
  changelog_wrapper: {
    flex: 1,
    flexGrow: 1,
    position: "relative",
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  triangle: {
    position: "absolute",
    left: -9,
    top: 12,
    borderStyle: "solid",
    borderTopWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 0,
    borderRightColor: COLOR.blue,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  version: {
    fontWeight: FONTWEIGHT.semiBold,
    fontSize: FONTSIZE.subtitle,
    color: COLOR.softWhite,
  },
  text: {
    paddingLeft: PADDING_MARGIN.md,
    marginVertical: PADDING_MARGIN.md,
    lineHeight: 30,
    fontSize: FONTSIZE.paragraph,
    color: COLOR.softWhite,
  },
});
