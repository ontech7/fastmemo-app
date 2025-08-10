import React from "react";
import { BlurView } from "expo-blur";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { WINDOW_HEIGHT, WINDOW_WIDTH } from "@/constants/carousel";
import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function LoadingSpinner({ visible, color = null, text = null }) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <BlurView intensity={50} experimentalBlurMethod="dimezisBlurView" tint="dark" style={styles.blurContainer}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={color || COLOR.softWhite} />
          {text && <Text style={styles.text}>{text}</Text>}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    position: "absolute",
    left: -16,
    top: -16,
    height: WINDOW_HEIGHT + 32,
    width: WINDOW_WIDTH + 32,
  },
  blurContainer: {
    flex: 1,
    padding: 20,
    margin: 16,
    textAlign: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginTop: PADDING_MARGIN.md,
    fontSize: FONTSIZE.subtitle,
    color: COLOR.softWhite,
  },
});
