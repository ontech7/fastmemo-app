import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon } from "react-native-heroicons/solid";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

const SLIDE_DURATION_MS = 220;

// Desaturated sand/amber palette, not part of the core COLOR constants
// because it is intentionally off-theme: the banner needs to stand out
// against the dark-blue home background to signal "something you should
// act on" without using a destructive color (red) or a loud accent
// (saturated yellow) that would feel like a warning.
const BANNER_BG = "#E8C77A";
const BANNER_BG_BORDER_TOP = "#C4A65C";
const BANNER_TEXT = "#1A1F3A";

interface Props {
  visible: boolean;
  onPress: () => void;
}

export default function UpdateAvailableBanner({ visible, onPress }: Props) {
  const { t } = useTranslation();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 80 }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.inner}>
        <Text style={styles.label} numberOfLines={1}>
          {t("banner.update_available")}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaLabel} numberOfLines={1}>
            {t("banner.update_available_cta")}
          </Text>
          <ArrowRightIcon size={14} color={COLOR.softWhite} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: SIZE.full,
    zIndex: 8,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: BANNER_BG,
    borderTopWidth: 1,
    borderTopColor: BANNER_BG_BORDER_TOP,
  },
  label: {
    flex: 1,
    color: BANNER_TEXT,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs + 2,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.darkBlue,
  },
  ctaLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
