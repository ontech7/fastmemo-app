import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import type { TagCount } from "@/libs/search/tags";

interface Props {
  tag: TagCount;
  onPress: (tag: TagCount) => void;
}

/** A tag and how many notes hold it, in the search's tag list: a press searches it. */
function TagRow({ tag, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(tag)}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.tag_row", { tag: tag.label, count: tag.count })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        #{tag.label}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.count}>{tag.count}</Text>
      </View>
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    minHeight: 44,
    paddingHorizontal: PADDING_MARGIN.lg - 2,
    paddingVertical: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    borderRadius: BORDER.big,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  pressed: { backgroundColor: GLASS.fillStrong },
  label: {
    flex: 1,
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.small,
    backgroundColor: GLASS.fillStrong,
    alignItems: "center",
  },
  count: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
});

export default memo(TagRow);
