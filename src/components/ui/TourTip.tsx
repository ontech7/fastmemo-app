import { BORDER, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface Props {
  step: number;
  total: number;
  title: string;
  text: string;
  /** The main button; without it the step waits for the user to do what it says. */
  actionLabel?: string;
  onAction?: () => void;
  /** Ends the tour; without it there's no "Skip" (the last step). */
  onSkip?: () => void;
  /** An arrow on the card's top or bottom edge, `left` from its left edge (its center); none when absent. */
  arrow?: { side: "top" | "bottom"; left: number };
  style?: StyleProp<ViewStyle>;
}

const ARROW_SIZE = 14;

/** The card of a first-note tour step (TourSpotlight places it next to what it explains). */
export default function TourTip({ step, total, title, text, actionLabel, onAction, onSkip, arrow, style }: Props) {
  const { t } = useTranslation();

  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [shown]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle, style]} aria-live="polite">
      <Text style={styles.step}>{t("tour.step", { current: step, total })}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>

      <View style={styles.actions}>
        {onSkip && (
          <TouchableOpacity onPress={onSkip} accessibilityRole="button" hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.skip}>{t("tour.skip")}</Text>
          </TouchableOpacity>
        )}

        {actionLabel && onAction && (
          <TouchableOpacity style={styles.action} onPress={onAction} accessibilityRole="button" activeOpacity={0.7}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {arrow && (
        <View
          style={[
            styles.arrow,
            arrow.side === "top" ? styles.arrowTop : styles.arrowBottom,
            { left: arrow.left - ARROW_SIZE / 2 },
          ]}
          aria-hidden
          focusable={false}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    maxWidth: 340,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.accentMutedBorder,
    ...SHADOW.glow,
  },
  step: {
    fontSize: FONTSIZE.small,
    fontFamily: FONT.medium,
    color: COLOR.textMuted,
  },
  title: {
    marginTop: PADDING_MARGIN.xs,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  text: {
    marginTop: PADDING_MARGIN.xs,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: COLOR.textSecondary,
  },
  actions: {
    marginTop: PADDING_MARGIN.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: PADDING_MARGIN.lg,
  },
  skip: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.medium,
    color: COLOR.textMuted,
  },
  action: {
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    borderWidth: 1,
    borderColor: COLOR.accentMutedBorder,
  },
  actionText: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
    color: COLOR.softWhite,
  },
  // A square turned 45°, half out of the card's edge; its inner half covers the card's border.
  arrow: {
    position: "absolute",
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    backgroundColor: COLOR.surface,
    borderColor: COLOR.accentMutedBorder,
    transform: [{ rotate: "45deg" }],
  },
  arrowBottom: {
    bottom: -ARROW_SIZE / 2 - 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  arrowTop: {
    top: -ARROW_SIZE / 2 - 1,
    borderLeftWidth: 1,
    borderTopWidth: 1,
  },
});
