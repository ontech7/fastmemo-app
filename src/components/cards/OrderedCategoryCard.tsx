import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";

import CategoryIcon from "@/components/CategoryIcon";

import type { Category } from "@/types";

interface Props {
  category: Category;
  order?: number | null;
  selected?: boolean;
  toggleCategory?: ((category: Category) => void) | null;
}

function OrderedCategoryCard({ category, order, selected = false, toggleCategory = null }: Props) {
  const { t } = useTranslation();

  const { index, name, icon } = category;

  const onPress = () => {
    if (toggleCategory) {
      toggleCategory(category);
    }
  };

  return (
    <View style={styles.buttonWrapper}>
      <TouchableOpacity activeOpacity={0.7} style={[styles.button, selected && styles.selectedButton]} onPress={onPress}>
        <View style={styles.categoryWrapper}>
          {!index && <CategoryIcon name={icon} color={selected ? COLOR.softWhite : COLOR.textPrimary} />}

          <Text style={[styles.categoryName, selected && styles.selectedName]}>{t(name)}</Text>
        </View>
      </TouchableOpacity>

      {order && (
        <View style={styles.categoryPosition_wrapper}>
          <Text style={styles.categoryPosition}>{order}</Text>
        </View>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  buttonWrapper: {
    position: "relative",
    width: SIZE.full,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  selectedButton: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  categoryPosition_wrapper: {
    position: "absolute",
    top: -6,
    left: -6,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.bg,
    borderWidth: 2,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.xs,
  },
  categoryPosition: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
  categoryWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryName: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.paragraph,
  },
  selectedName: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
  },
});

export default memo(OrderedCategoryCard);
