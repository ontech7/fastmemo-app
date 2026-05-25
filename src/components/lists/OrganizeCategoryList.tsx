import { StyleSheet, View } from "react-native";

import { SIZE } from "@/constants/styles";

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
  return (
    <View style={styles.categoryList}>
      {orderedCategories.reorganizedCategoryList.map(
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

      {orderedCategories.notNumberedCategoryList.map(
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
});
