import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { BLUR, BORDER, GLASS } from "@/constants/styles";

const isWeb = Platform.OS === "web";

interface Props {
  children?: ReactNode;
  intensity?: number;
  radius?: number;
  fill?: string;
  bordered?: boolean;
  /**
   * Enable the heavier real-blur backend on Android. Off by default to avoid
   * scroll jank — the translucent fill keeps the frosted look without it.
   */
  androidBlur?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function GlassSurface({
  children,
  intensity = BLUR.regular,
  radius = BORDER.normal,
  fill = GLASS.navyFill,
  bordered = true,
  androidBlur = false,
  style,
}: Props) {
  return (
    // On web, CSS paints positioned siblings (the absolute BlurView/fill) above
    // in-flow children, so the blur would cover the content. We make the root a
    // stacking context and push the overlays behind (zIndex -1) so children stay
    // on top while backdrop-filter still blurs what's behind the surface. Native
    // already paints children last (on top), so this is web-only.
    <View style={[{ borderRadius: radius }, styles.clip, isWeb && styles.stackWeb, bordered && styles.bordered, style]}>
      <BlurView
        intensity={intensity}
        tint={BLUR.tint}
        experimentalBlurMethod={Platform.OS === "android" && androidBlur ? "dimezisBlurView" : undefined}
        style={[StyleSheet.absoluteFill, isWeb && styles.behindWeb]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, isWeb && styles.behindWeb, { backgroundColor: fill }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  // Web-only: establish a stacking context so the overlays' negative zIndex
  // stays contained within the surface (behind the children, not the page).
  stackWeb: {
    position: "relative",
    zIndex: 0,
  },
  behindWeb: {
    zIndex: -1,
  },
});
