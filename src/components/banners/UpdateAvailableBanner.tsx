import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowUpTrayIcon } from "react-native-heroicons/outline";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

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
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.inner}>
        <View style={styles.iconContainer}>
          <ArrowUpTrayIcon size={18} color={COLOR.darkBlue} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {t("banner.update_available")}
        </Text>
        <Text style={styles.cta} numberOfLines={1}>
          {t("banner.update_available_cta")}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 68,
    left: PADDING_MARGIN.lg,
    right: 130,
    zIndex: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.blue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  iconContainer: {
    padding: PADDING_MARGIN.xs,
    borderRadius: BORDER.small,
    backgroundColor: COLOR.lightBlue,
  },
  label: {
    flex: 1,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
  cta: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
