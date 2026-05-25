import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon } from "react-native-heroicons/solid";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";

const SLIDE_DURATION_MS = 220;

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

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: SIZE.full,
    zIndex: 8,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS.border,
  },
  label: {
    flex: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs + 2,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accentMutedBorder,
  },
  ctaLabel: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
});
