import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";

import { COLOR } from "@/constants/styles";

interface Props {
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * JS splash shown while fonts load. Solid app background color + centered logo,
 * kept intentionally identical to the native splash (same COLOR.bg + same logo
 * at the same size) so the native -> JS handoff has no flicker. No gradient /
 * AppBackground here on purpose: matching the native splash exactly is what
 * makes it reliable — the gradient backdrop lives behind the real app screens.
 */
export default function SplashScreenView({ onLayout }: Props) {
  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />

      <Image source={require("@/assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 150,
    height: 150,
  },
});
