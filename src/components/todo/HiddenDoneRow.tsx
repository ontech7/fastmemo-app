import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  count: number;
  onShow: () => void;
}

/** Under a list whose completed items are hidden: how many, and the way to show them again (spec B.7). */
export default function HiddenDoneRow({ count, onShow }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {t("note.hidden_done", { count })}
      </Text>
      <Pressable onPress={onShow} accessibilityRole="button" hitSlop={PADDING_MARGIN.sm} style={styles.button}>
        <Text style={styles.show}>{t("note.show")}</Text>
      </Pressable>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.xs,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: GLASS.border,
  },
  label: {
    flexShrink: 1,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  button: {
    paddingVertical: PADDING_MARGIN.xs,
  },
  show: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
  },
});
