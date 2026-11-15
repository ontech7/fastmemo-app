import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ChevronDownIcon from "react-native-heroicons/outline/ChevronDownIcon";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { changelogLines } from "@/utils/changelog";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { DURATION, EASING } from "@/constants/motion";

interface Props {
  text: string;
  /** An older version's list: smaller, with grey dots. */
  small?: boolean;
  /** False while the list is out of sight (a closed version): its button takes no focus. */
  focusable?: boolean;
}

/** Past this many lines the list folds; one hidden line isn't worth a button, so it folds from two. */
const LIMIT = 5;
/** How much of the first hidden line shows under the fade. */
const PEEK = 22;
const FADE = 56;
/** Before the lines are measured nothing is cut. */
const UNMEASURED = 100000;

/**
 * A version's changelog: its lines with their lead in bold (utils/changelog). A long one shows its first lines, the next
 * fading out, and "Show more" opens the rest: the first lines are the ones that matter, the others are there for whoever
 * wants them.
 */
export default function ChangelogBullets({ text, small = false, focusable = true }: Props) {
  const { t } = useTranslation();

  const lines = useMemo(() => changelogLines(text), [text]);
  const foldable = lines.length > LIMIT + 1;
  const hidden = lines.length - LIMIT;

  const [open, setOpen] = useState(false);
  const gradientId = "fade" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const progress = useSharedValue(0);
  const fullHeight = useSharedValue(0);
  const foldedHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: DURATION.slow, easing: open ? EASING.enter : EASING.exit }));
  }, [open, progress]);

  const clipStyle = useAnimatedStyle(() => {
    const folded = foldedHeight.get();
    const full = Math.max(fullHeight.get(), folded);
    return { maxHeight: folded > 0 ? interpolate(progress.get(), [0, 1], [folded, full]) : UNMEASURED };
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * progress.get()}deg` }] }));

  const list = (
    <View onLayout={foldable ? (e) => fullHeight.set(e.nativeEvent.layout.height) : undefined} style={styles.list}>
      {lines.map((line, i) => (
        <View
          key={i}
          style={styles.row}
          onLayout={foldable && i === LIMIT ? (e) => foldedHeight.set(e.nativeEvent.layout.y + PEEK) : undefined}
        >
          {line.bullet && <View style={[styles.dot, small && styles.dotSmall]} />}
          <Text style={[styles.text, small && styles.textSmall]}>
            {line.lead ? <Text style={styles.lead}>{line.lead}</Text> : null}
            {line.rest}
          </Text>
        </View>
      ))}
    </View>
  );

  if (!foldable) return list;

  return (
    <View>
      <Animated.View style={[styles.clip, clipStyle]}>
        {list}
        <Animated.View style={[styles.fade, fadeStyle, { pointerEvents: "none" }]} aria-hidden>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLOR.surface} stopOpacity="0" />
                <Stop offset="0.85" stopColor={COLOR.surface} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      </Animated.View>

      <TouchableOpacity
        accessibilityRole="button"
        aria-expanded={open}
        focusable={focusable}
        activeOpacity={0.7}
        style={styles.more}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={styles.moreText}>{open ? t("changelog.show_less") : t("changelog.show_more")}</Text>
        {!open && <Text style={styles.moreCount}>· {t("changelog.more_count", { count: hidden })}</Text>}
        <Animated.View style={chevronStyle}>
          <ChevronDownIcon size={16} color={COLOR.textSecondary} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  list: {
    gap: PADDING_MARGIN.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: PADDING_MARGIN.sm + 2,
  },
  dot: {
    width: 6,
    height: 6,
    marginTop: 9,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentSoft,
  },
  dotSmall: {
    marginTop: 8,
    backgroundColor: COLOR.textMuted,
  },
  text: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    lineHeight: 23,
    color: COLOR.textSecondary,
  },
  textSmall: {
    fontSize: FONTSIZE.medium,
    lineHeight: 21,
  },
  lead: {
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  clip: {
    overflow: "hidden",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE,
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.xs + 2,
    marginTop: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm + 2,
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fill,
  },
  moreText: {
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
    color: COLOR.textPrimary,
  },
  moreCount: {
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
    color: COLOR.textSecondary,
  },
});
