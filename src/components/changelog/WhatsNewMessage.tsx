import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import type { ViewInstance } from "react-native";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";
import SparklesIcon from "react-native-heroicons/outline/SparklesIcon";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { WHATS_NEW_CHIP } from "@/components/buttons/WhatsNewButton";
import { configs } from "@/configs";
import { useRouter } from "@/hooks/useRouter";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { measureInWindow, measureTourTarget } from "@/libs/tourTargets";
import { landWhatsNew, seenWhatsNew, WHATS_NEW_DELAY, WHATS_NEW_HOLD, WHATS_NEW_TARGET } from "@/libs/whatsNew";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { DURATION, EASING } from "@/constants/motion";

interface Props {
  /** The home is in front and free (no dialog, menu or selection): the message waits for it, or leaves the icon. */
  active: boolean;
  /** The main column, in the parent's coordinates: the message is centered in it. */
  left: number;
  width: number;
  /** From the parent's bottom: above the add button. */
  bottom: number;
}

const ICON = 20;
const BORDER_WIDTH = 1;
/** How far the message rises as it appears. */
const RISE = 16;

/**
 * The home's message after an update (libs/whatsNew): it rises at the bottom, stays a moment, then folds up on its icon
 * and flies into the sidebar, where WhatsNewButton takes over. A tap opens the changelog. Nothing waits on it: the home
 * works the whole time.
 */
export default function WhatsNewMessage({ active, left, width, bottom }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const phase = useWhatsNew();
  const reduceMotion = useReducedMotion();
  const shown = phase === "message";

  const version = Platform.OS === "web" ? configs.app.version.web : configs.app.version.mobile;
  const label = t("changelog.updated_to", { version });
  const action = t("changelog.whats_new");

  const row = useRef<ViewInstance | null>(null);
  const started = useRef(false);

  const appear = useSharedValue(0);
  const fold = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);

  useEffect(() => {
    if (!shown) return;
    // The home went away (a note opened, a dialog came): no flight, the icon is simply there.
    if (!active) {
      if (started.current) landWhatsNew(false);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const land = () => landWhatsNew(true);

    // The text goes and the pill closes on its icon (its left edge stays), then it lifts and sweeps into the sidebar:
    // two moves with different curves draw the arc.
    const fly = async () => {
      if (reduceMotion) {
        appear.set(
          withTiming(0, { duration: DURATION.base, easing: EASING.exit }, (done) => {
            if (done) scheduleOnRN(land);
          })
        );
        return;
      }
      const [from, to] = await Promise.all([measureInWindow(row.current), measureTourTarget(WHATS_NEW_TARGET)]);
      if (cancelled) return;
      if (!from || !to) {
        landWhatsNew(false);
        return;
      }
      // `from` is the pill's inside (its border excluded); the chip sits centered in its slot.
      const dx = to.x + (to.width - WHATS_NEW_CHIP) / 2 - (from.x - BORDER_WIDTH);
      const dy = to.y + (to.height - WHATS_NEW_CHIP) / 2 - (from.y - BORDER_WIDTH);
      fold.set(
        withTiming(1, { duration: DURATION.slow, easing: EASING.enter }, (done) => {
          if (!done) return;
          flyX.set(withTiming(dx, { duration: DURATION.slow, easing: EASING.exit }));
          flyY.set(
            withTiming(dy, { duration: DURATION.slow, easing: EASING.enter }, (ok) => {
              if (ok) scheduleOnRN(land);
            })
          );
        })
      );
    };

    timers.push(
      setTimeout(() => {
        started.current = true;
        appear.set(withTiming(1, { duration: DURATION.slow, easing: EASING.enter }));
        AccessibilityInfo.announceForAccessibility(`${label}. ${action}`);
        timers.push(setTimeout(fly, DURATION.slow + WHATS_NEW_HOLD));
      }, WHATS_NEW_DELAY)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [shown, active, reduceMotion, label, action, appear, fold, flyX, flyY]);

  // The pill keeps its own width; folding caps it down to the chip. Centered in the column, it shrinks from both sides,
  // so the move slides it back by half of what it lost: its left edge (and the icon) stays put.
  const moveStyle = useAnimatedStyle(() => {
    const full = pillWidth.get();
    const w = interpolate(fold.get(), [0.2, 1], [full, WHATS_NEW_CHIP], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: flyX.get() - (full > 0 ? (full - w) / 2 : 0) },
        { translateY: flyY.get() + (1 - appear.get()) * RISE },
      ] as const,
    };
  });
  const pillStyle = useAnimatedStyle(() => {
    const full = pillWidth.get();
    const f = fold.get();
    return {
      opacity: appear.get(),
      maxWidth: full > 0 && f > 0 ? interpolate(f, [0.2, 1], [full, WHATS_NEW_CHIP], Extrapolation.CLAMP) : width,
      borderRadius: interpolate(f, [0, 1], [WHATS_NEW_CHIP / 2, BORDER.normal]),
      borderColor: interpolateColor(f, [0, 1], [GLASS.border, COLOR.accentMuted]),
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fold.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));

  if (!shown) return null;

  return (
    <View style={[styles.anchor, { left, width, bottom, pointerEvents: "box-none" }]}>
      <Animated.View style={moveStyle}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${action}`}
          activeOpacity={0.7}
          onPress={() => {
            seenWhatsNew();
            router.push("/changelog");
          }}
        >
          <Animated.View
            style={[styles.pill, pillStyle]}
            onLayout={(e) => {
              if (fold.get() === 0) pillWidth.set(e.nativeEvent.layout.width);
            }}
          >
            <View ref={row} collapsable={false} style={styles.row}>
              <SparklesIcon size={ICON} color={COLOR.accentSoft} />
              <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, textStyle]}>
                {label}
              </Animated.Text>
              <Animated.View style={[styles.action, textStyle]}>
                <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.actionText}>
                  {action}
                </Animated.Text>
                <ChevronRightIcon size={14} color={COLOR.accentSoft} />
              </Animated.View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    alignItems: "center",
    zIndex: 20,
  },
  pill: {
    height: WHATS_NEW_CHIP,
    overflow: "hidden",
    borderWidth: BORDER_WIDTH,
    backgroundColor: GLASS.toastFill,
    ...SHADOW.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: WHATS_NEW_CHIP - 2 * BORDER_WIDTH,
    gap: PADDING_MARGIN.sm,
    // The icon sits where the folded chip's center will be.
    paddingLeft: (WHATS_NEW_CHIP - 2 * BORDER_WIDTH - ICON) / 2,
    paddingRight: PADDING_MARGIN.lg,
  },
  label: {
    flexShrink: 1,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.toast,
    color: COLOR.textPrimary,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.xs,
  },
  actionText: {
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.toast,
    color: COLOR.accentSoft,
  },
});
