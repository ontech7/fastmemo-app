import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ChevronDownIcon from "react-native-heroicons/outline/ChevronDownIcon";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import ChangelogBullets from "@/components/changelog/ChangelogBullets";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { DURATION, EASING } from "@/constants/motion";

interface Props {
  version: string;
  text: string;
  /** The version installed: always open, in its own card at the top. */
  current?: boolean;
  /** The last of the older versions: the timeline's line stops at its dot. */
  isLast?: boolean;
}

/** One version of the changelog: the current one open in a card, an older one a row on the timeline that opens. */
export default function ChangelogItem({ version, text, current = false, isLast = false }: Props) {
  const [open, setOpen] = useState(false);

  const progress = useSharedValue(0);
  const bodyHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: DURATION.slow, easing: open ? EASING.enter : EASING.exit }));
  }, [open, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [0, bodyHeight.get()]),
    opacity: progress.get(),
  }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * progress.get()}deg` }] }));

  if (current) {
    return (
      <View style={styles.currentCard}>
        <ChangelogBullets text={text} />
      </View>
    );
  }

  return (
    <View style={styles.item}>
      <View style={styles.rail}>
        <View style={styles.dot} />
        {!isLast && <View style={styles.line} />}
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          accessibilityRole="button"
          aria-expanded={open}
          activeOpacity={0.7}
          style={styles.head}
          onPress={() => setOpen((o) => !o)}
        >
          <Text style={styles.version}>{version}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDownIcon size={16} color={COLOR.textMuted} />
          </Animated.View>
        </TouchableOpacity>

        {/* Always there, so its height is known before it opens; closed, a screen reader skips it. */}
        <Animated.View style={[styles.body, bodyStyle]} aria-hidden={!open}>
          <View style={styles.bodyInner} onLayout={(e) => bodyHeight.set(e.nativeEvent.layout.height)}>
            <ChangelogBullets text={text} small focusable={open} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  currentCard: {
    padding: PADDING_MARGIN.lg,
    borderRadius: BORDER.big,
    borderWidth: 1,
    borderColor: COLOR.accentMuted,
    backgroundColor: COLOR.surface,
    ...SHADOW.glow,
  },
  item: {
    flexDirection: "row",
  },
  rail: {
    width: 28,
    alignItems: "flex-start",
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 17,
    marginLeft: 1,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.textMuted,
  },
  line: {
    flex: 1,
    width: 2,
    marginLeft: 6,
    marginTop: PADDING_MARGIN.xs,
    marginBottom: -PADDING_MARGIN.md,
    backgroundColor: COLOR.surfaceMuted,
  },
  card: {
    flex: 1,
    marginBottom: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.hairline,
    backgroundColor: COLOR.surface,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  version: {
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
    color: COLOR.textPrimary,
  },
  body: {
    overflow: "hidden",
  },
  bodyInner: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
  },
});
