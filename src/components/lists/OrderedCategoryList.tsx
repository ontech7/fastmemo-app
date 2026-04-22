import { StyleSheet, View } from "react-native";

import { PADDING_MARGIN } from "@/constants/styles";

import OrderedCategoryCard from "../cards/OrderedCategoryCard";

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

export default function OrderedCategoryList({ orderedCategories, setOrderedCategories, editMode }: Props) {
  return (
    <View style={styles.categoryList}>
      {orderedCategories.reorganizedCategoryList.map(
        (category, i) => !category.index && <OrderedCategoryCard key={category.icon} category={category} order={i} />
      )}

      {orderedCategories.notNumberedCategoryList.map(
        (category, i) => !category.index && <OrderedCategoryCard key={category.icon} category={category} order={i} />
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -PADDING_MARGIN.lg,
  },
});
