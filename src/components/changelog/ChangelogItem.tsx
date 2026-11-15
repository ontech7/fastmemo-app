import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ChevronDownIcon from "react-native-heroicons/outline/ChevronDownIcon";

import ChangelogBullets from "@/components/changelog/ChangelogBullets";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

interface Props {
  version: string;
  text: string;
  /** The version installed: always open, in its own card at the top. */
  current?: boolean;
  /** The last of the older versions: the timeline's line stops at its dot. */
  isLast?: boolean;
}

/**
 * One version of the changelog: the current one open in a card, an older one a row on the timeline that opens at once,
 * with no animation, like the help screen's sections.
 */
export default function ChangelogItem({ version, text, current = false, isLast = false }: Props) {
  const [open, setOpen] = useState(false);

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
          <View style={open && styles.chevronOpen}>
            <ChevronDownIcon size={16} color={COLOR.textMuted} />
          </View>
        </TouchableOpacity>

        {open && (
          <View style={styles.body}>
            <ChangelogBullets text={text} small />
          </View>
        )}
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
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  body: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
  },
});
