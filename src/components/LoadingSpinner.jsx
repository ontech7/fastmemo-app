import React from "react";
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";

import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

export default function LoadingSpinner({ visible, color = null, text = null }) {
  if (!visible) return null;

  return (
    <View style={[styles.container, { height: WINDOW_HEIGHT + 32, width: WINDOW_WIDTH + 32 }]}>
      <ActivityIndicator size="large" color={color || COLOR.softWhite} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    position: "absolute",
    left: -16,
    top: -16,
    backgroundColor: "#0008",
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginTop: PADDING_MARGIN.md,
    fontSize: FONTSIZE.subtitle,
    color: COLOR.softWhite,
  },
});
