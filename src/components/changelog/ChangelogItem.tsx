import { StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  version: string;
  text: string;
  isFirst: boolean;
  isLast: boolean;
}

export default function ChangelogItem({ version, text, isFirst, isLast }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.dotLine_wrapper}>
        <View style={[styles.dot, isFirst && styles.dotFirst]} />

        {!isLast && <View style={styles.line} />}
      </View>

      <View style={[styles.changelog_wrapper, !isFirst && { opacity: 0.7 }]}>
        <View style={styles.triangle} />

        <Text style={styles.version}>{version}</Text>

        <View style={styles.list}>
          {text.split("\n").map((line, i) => {
            const bulleted = line.startsWith("•");
            return (
              <View key={i} style={styles.row}>
                {bulleted && <Text style={styles.text}>•</Text>}
                <Text style={[styles.text, styles.rowText]}>{bulleted ? line.replace(/^•\s*/, "") : line}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.xl,
  },
  dotLine_wrapper: {
    width: 45,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.textMuted,
    marginTop: PADDING_MARGIN.md + 2,
  },
  dotFirst: {
    backgroundColor: COLOR.accentSoft,
  },
  line: {
    marginTop: -1,
    marginLeft: 7,
    marginBottom: -60,
    width: 2,
    flexGrow: 1,
    backgroundColor: COLOR.surfaceMuted,
  },
  changelog_wrapper: {
    flex: 1,
    flexGrow: 1,
    position: "relative",
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  triangle: {
    position: "absolute",
    left: -9,
    top: 12,
    borderStyle: "solid",
    borderTopWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 0,
    borderRightColor: COLOR.surface,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  version: {
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    color: COLOR.textPrimary,
  },
  // One row per "• " line: wrapped lines hang under the text, not under the bullet.
  list: {
    paddingLeft: PADDING_MARGIN.md,
    marginVertical: PADDING_MARGIN.md,
    gap: PADDING_MARGIN.sm,
  },
  row: {
    flexDirection: "row",
    gap: PADDING_MARGIN.sm,
  },
  rowText: {
    flex: 1,
  },
  text: {
    lineHeight: 24,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.regular,
    color: COLOR.textSecondary,
  },
});
