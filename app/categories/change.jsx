import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import BackButton from "@/components/buttons/BackButton";
import OrderedCategoryCard from "@/components/cards/OrderedCategoryCard";
import SafeAreaView from "@/components/SafeAreaView";
import { getCategories } from "@/slicers/categoriesSlice";
import { changeNoteCategory, getNote } from "@/slicers/notesSlice";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function ChangeCategoryScreen() {
  const { t } = useTranslation();

  const { noteId } = useLocalSearchParams();
  const currentNote = useSelector(getNote(noteId));

  const [selectedCategory, setSelectedCategory] = useState(currentNote?.category);
  const categories = useSelector(getCategories);

  const router = useRouter();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!currentNote) {
      router.back();
    }
  }, [currentNote, router]);

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
        note: currentNote,
        iconTo: selectedCategory.icon,
        nameTo: selectedCategory.name,
      })
    );

    router.dismiss();
    router.replace(`/notes/${currentNote.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("changecategory.title")}</Text>

        {selectedCategory && (
          <TouchableOpacity activeOpacity={0.7} onPress={updateExistentCategory}>
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
