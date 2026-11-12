import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BookOpenIcon from "react-native-heroicons/outline/BookOpenIcon";
import EyeSlashIcon from "react-native-heroicons/outline/EyeSlashIcon";
import KeyIcon from "react-native-heroicons/outline/KeyIcon";
import StarIcon from "react-native-heroicons/outline/StarIcon";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { DURATION, EASING } from "@/constants/motion";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { toast } from "@/utils/toast";

/** Well clear of the screen's bottom edge: a bar that floats, not one resting on the gesture bar. */
const MARGIN_BOTTOM = PADDING_MARGIN.xl;
/** How far the bar rises as it fades in. */
const RISE = 8;

/** Its height before it is measured (row + bottom margin). */
export const SELECTION_BAR_RESERVED = 64 + MARGIN_BOTTOM;
/**
 * Narrower actions show their icon alone: a word doesn't fit under it (a large display size makes the column ~210 dp,
 * four actions of ~52 dp). The word is then the icon's long press and its screen reader label.
 */
const LABEL_MIN_ACTION_WIDTH = 64;
/** The words grow with the system font size up to this much: past it they would not fit, and the bar would grow. */
const LABEL_MAX_FONT_SCALE = 1.3;

interface Props {
  /** Out of select mode: faded out, no touch, focus or screen reader; still mounted, so it is measured before it shows. */
  hidden: boolean;
  /** Reports the bar's height (row + bottom margin), for the add button above it and the end of the list. */
  onHeightChange?: (height: number) => void;
  onImportant: () => void;
  onProtect: () => void;
  onHide: () => void;
  onReadOnly: () => void;
}

/**
 * Select mode's actions on the selected notes, at the bottom of the home column: where the quick note bar is (it fades
 * out as this one fades in), or over the end of the list when quick note is off. An icon with its word under it, or
 * the icon alone where the word doesn't fit; either way its height doesn't follow the system font size, and a long
 * press on an action shows its name.
 */
export default function SelectionBar({ hidden, onHeightChange, onImportant, onProtect, onHide, onReadOnly }: Props) {
  const { t } = useTranslation();

  // Measured, so the choice follows the column's real width (display size, sidebar, window size on web).
  const [barWidth, setBarWidth] = useState(0);
  const compact = barWidth > 0 && barWidth / 4 < LABEL_MIN_ACTION_WIDTH;

  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    shown.value = withTiming(hidden ? 0 : 1, {
      duration: hidden ? DURATION.fast : DURATION.base,
      easing: hidden ? EASING.exit : EASING.enter,
    });
  }, [hidden, shown]);
  const shownStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: RISE * (1 - shown.value) }],
  }));

  return (
    <Animated.View
      style={[styles.wrapper, shownStyle, { pointerEvents: hidden ? "none" : "auto" }]}
      aria-hidden={hidden}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        <Action
          Icon={StarIcon}
          label={t("note.settings.important")}
          onPress={onImportant}
          focusable={!hidden}
          compact={compact}
        />
        <Action Icon={KeyIcon} label={t("note.settings.protect")} onPress={onProtect} focusable={!hidden} compact={compact} />
        <Action Icon={EyeSlashIcon} label={t("note.settings.hide")} onPress={onHide} focusable={!hidden} compact={compact} />
        <Action
          Icon={BookOpenIcon}
          label={t("note.settings.readonly")}
          onPress={onReadOnly}
          focusable={!hidden}
          compact={compact}
        />
      </View>
    </Animated.View>
  );
}

interface ActionProps {
  Icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  focusable: boolean;
  /** The icon alone, larger. */
  compact: boolean;
}

function Action({ Icon, label, onPress, focusable, compact }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => toast(label)}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon size={compact ? 24 : 20} color={COLOR.softWhite} />
      {compact ? null : (
        <Text
          style={styles.label}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: MARGIN_BOTTOM,
  },
  // Solid, not glass: over the end of the list (quick note off) it must read against the light cards.
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: PADDING_MARGIN.xs,
    paddingVertical: PADDING_MARGIN.xs,
    backgroundColor: COLOR.surfaceMuted,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: BORDER.big,
    ...SHADOW.card,
  },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.xs,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.xs,
    borderRadius: BORDER.normal,
  },
  // Pressed: a light fill under the action.
  pressed: {
    backgroundColor: GLASS.fillStrong,
  },
  label: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
});
