import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN, SIZE } from "@/constants/styles";

import OrganizeCategoryCard from "@/components/cards/OrganizeCategoryCard";

import type { Category } from "@/types";

interface OrderedCategories {
  reorganizedCategoryList: Category[];
  notNumberedCategoryList: Category[];
}

interface Props {
  orderedCategories: OrderedCategories;
  setOrderedCategories: (categories: OrderedCategories) => void;
  editMode: boolean;
}

export default function OrganizeCategoryList({ orderedCategories, setOrderedCategories, editMode }: Props) {
  const { t } = useTranslation();

  const { reorganizedCategoryList, notNumberedCategoryList } = orderedCategories;

  // "All" is the index category: always pinned first and never reorderable/editable.
  const indexCategory =
    reorganizedCategoryList.find((category) => category.index) ?? notNumberedCategoryList.find((category) => category.index);

  const hasCustomCategories =
    reorganizedCategoryList.some((category) => !category.index) || notNumberedCategoryList.some((category) => !category.index);

  return (
    <View style={styles.categoryList}>
      {indexCategory && (
        <OrganizeCategoryCard
          category={indexCategory}
          order={0}
          locked
          editMode={editMode}
          orderedCategories={orderedCategories}
          setOrderedCategories={setOrderedCategories}
        />
      )}

      {reorganizedCategoryList.map(
        (category, i) =>
          !category.index && (
            <OrganizeCategoryCard
              key={category.icon}
              category={category}
              order={i}
              editMode={editMode}
              orderedCategories={orderedCategories}
              setOrderedCategories={setOrderedCategories}
            />
          )
      )}

      {notNumberedCategoryList.map(
        (category, i) =>
          !category.index && (
            <OrganizeCategoryCard
              key={category.icon}
              category={category}
              order={i}
              notNumbered={true}
              editMode={editMode}
              orderedCategories={orderedCategories}
              setOrderedCategories={setOrderedCategories}
            />
          )
      )}

      {!hasCustomCategories && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t("organizecategory.empty")}</Text>
        </View>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: SIZE.full,
  },
  emptyState: {
    width: SIZE.full,
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  emptyStateText: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
    lineHeight: 22,
  },
});
