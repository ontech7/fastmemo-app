import { StyleSheet, Text, View } from "react-native";

import CategoryIcon from "@/components/CategoryIcon";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  title: string;
  icon: string;
}

export default function SectionHeader({ title, icon }: Props) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderIcon}>
        <CategoryIcon name={icon} color={COLOR.textPrimary} />
      </View>

      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.lg,
  },
  sectionHeaderIcon: {
    marginRight: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.normal,
  },
  sectionHeaderTitle: {
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
    paddingVertical: PADDING_MARGIN.sm,
  },
});
