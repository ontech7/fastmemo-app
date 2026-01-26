import React from "react";
import { StyleSheet, View } from "react-native";

import { PADDING_MARGIN } from "@/constants/styles";

import OrderedCategoryCard from "../cards/OrderedCategoryCard";

export default function OrderedCategoryList({ orderedCategories, setOrderedCategories, editMode }) {
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
