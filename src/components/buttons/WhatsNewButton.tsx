import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import SparklesIcon from "react-native-heroicons/outline/SparklesIcon";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolateColor,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useRouter } from "@/hooks/useRouter";
import { useTourTarget } from "@/hooks/useTourTarget";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { seenWhatsNew, WHATS_NEW_TARGET, whatsNewLanded } from "@/libs/whatsNew";

import { BORDER, COLOR, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { DURATION, EASING, LOOP } from "@/constants/motion";

/** The chip's side: the home's message folds up to this size before it flies here (WhatsNewMessage). */
export const WHATS_NEW_CHIP = 40;

/** The message arrives: the chip settles from a little larger, and a ring spreads out of it. */
const LAND = new Keyframe({
  0: { transform: [{ scale: 1.15 }] },
  100: { transform: [{ scale: 1 }], easing: EASING.enter },
}).duration(DURATION.slow);
const RING = new Keyframe({
  0: { opacity: 0.7, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 1.9 }], easing: EASING.enter },
}).duration(DURATION.slow * 2);

/**
 * The sidebar's icon for the news of a new version (libs/whatsNew): its slot is there from the home's message on, so the
 * message knows where to fly; the icon shows once it lands (or at once, on a later launch) and its border breathes until
 * the changelog is opened.
 */
export default function WhatsNewButton() {
  const { t } = useTranslation();
  const router = useRouter();

  const phase = useWhatsNew();
  const reduceMotion = useReducedMotion();
  const slot = useTourTarget(WHATS_NEW_TARGET);

  const visible = phase === "icon";
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      breath.set(1);
      return;
    }
    breath.set(withRepeat(withTiming(1, { duration: LOOP.breathe, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => {
      cancelAnimation(breath);
      breath.set(0);
    };
  }, [visible, reduceMotion, breath]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(breath.get(), [0, 1], [COLOR.accentMuted, COLOR.accentSoft]),
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * breath.get() }));

  if (phase === "none") return null;

  const landed = whatsNewLanded();

  return (
    <View style={styles.container}>
      <View ref={slot} collapsable={false} style={styles.slot}>
        {visible && (
          <Animated.View entering={landed ? LAND : FadeIn.duration(DURATION.slow)} style={styles.fill}>
            <Animated.View style={[styles.glow, glowStyle, { pointerEvents: "none" }]} />
            {landed && <Animated.View entering={RING} style={[styles.ring, { pointerEvents: "none" }]} />}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("a11y.whats_new")}
              activeOpacity={0.7}
              style={styles.fill}
              onPress={() => {
                seenWhatsNew();
                router.push("/changelog");
              }}
            >
              <Animated.View style={[styles.chip, borderStyle]}>
                <SparklesIcon size={22} color={COLOR.accentSoft} />
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.xs,
  },
  slot: {
    width: WHATS_NEW_CHIP,
    height: WHATS_NEW_CHIP,
  },
  fill: {
    width: WHATS_NEW_CHIP,
    height: WHATS_NEW_CHIP,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.normal,
    borderWidth: 1,
    backgroundColor: COLOR.accentFaint,
  },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentFaint,
    ...SHADOW.glow,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.accentSoft,
    opacity: 0,
  },
});
