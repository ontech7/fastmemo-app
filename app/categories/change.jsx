import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import { retrieveNote, storeNote } from "@/libs/registry";
import BackButton from "@/components/buttons/BackButton";
import OrderedCategoryCard from "@/components/cards/OrderedCategoryCard";
import { getCategories } from "@/slicers/categoriesSlice";
import { changeNoteCategory } from "@/slicers/notesSlice";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function ChangeCategoryScreen() {
  const { t } = useTranslation();

  const note = retrieveNote();

  const [selectedCategory, setSelectedCategory] = useState(note.category);
  const categories = useSelector(getCategories);

  const router = useRouter();

  const dispatch = useDispatch();

  const toggleCategory = useCallback((_selectedCategory) => {
    setSelectedCategory((prevCategory) => {
      if (prevCategory.icon == "" || prevCategory.icon != _selectedCategory.icon) {
        return _selectedCategory;
      } else {
        return prevCategory;
      }
    });
  }, []);

  const updateExistentCategory = () => {
    dispatch(
      changeNoteCategory({
        note,
        iconTo: selectedCategory.icon,
        nameTo: selectedCategory.name,
      })
    );

    storeNote({
      ...note,
      category: {
        order: note.category.order ?? 0,
        icon: selectedCategory.icon,
        name: selectedCategory.name,
        index: selectedCategory.icon === "none",
        selected: note.category.selected,
      },
    });

    router.dismiss();
    router.replace(note.type === "text" ? "/notes/text" : "/notes/todo");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("changecategory.title")}</Text>

        {selectedCategory && (
          <TouchableOpacity onPress={updateExistentCategory}>
            <CheckIcon size={28} color={COLOR.softWhite} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.categoryList}>
        {categories.map((category, i) => (
          <OrderedCategoryCard
            key={category.icon}
            category={category}
            order={i + 1}
            selected={category.icon === selectedCategory.icon}
            toggleCategory={toggleCategory}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
    height: SIZE.full,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    flexGrow: 1,
    textAlign: "center",
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -PADDING_MARGIN.lg,
  },
});
