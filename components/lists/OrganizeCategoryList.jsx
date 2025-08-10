import React from "react";
import { StyleSheet, View } from "react-native";

import { PADDING_MARGIN } from "@/constants/styles";

import OrganizeCategoryCard from "../cards/OrganizeCategoryCard";

export default function OrganizeCategoryList({ orderedCategories, setOrderedCategories, editMode }) {
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
    marginRight: -PADDING_MARGIN.lg,
  },
});
