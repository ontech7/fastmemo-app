import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import CloudArrowDownIcon from "react-native-heroicons/solid/CloudArrowDownIcon";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useAppUpdate } from "@/providers/AppUpdateProvider";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";
import { DURATION, LOOP } from "@/constants/motion";

/** The button pops in a little past its size and settles. */
const APPEAR_EASING = Easing.out(Easing.back(1.6));

/**
 * Sidebar action that surfaces an available app update. Hidden until an update
 * is found, then pops in and gently pulses to draw the eye without nagging.
 * Rendered outside the scrollable category list, so it never overlaps it.
 */
export default function UpdateAppButton() {
  const { t } = useTranslation();

  const { updateAvailable, openUpdate } = useAppUpdate();

  const appear = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!updateAvailable) return;

    appear.value = withTiming(1, { duration: DURATION.slow, easing: APPEAR_EASING });
    pulse.value = withRepeat(withTiming(1.14, { duration: LOOP.pulse, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [updateAvailable, appear, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: appear.value * pulse.value }],
  }));

  if (!updateAvailable) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={openUpdate}
        accessibilityRole="button"
        accessibilityLabel={t("generalsettings.update_available")}
      >
        <CloudArrowDownIcon size={24} color={COLOR.accentSoft} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  button: { padding: PADDING_MARGIN.sm },
});
