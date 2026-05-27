import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import type { Category } from "@/types";
import BackButton from "@/components/buttons/BackButton";
import OrderedCategoryCard from "@/components/cards/OrderedCategoryCard";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { useRouter } from "@/hooks/useRouter";
import { getCategories } from "@/slicers/categoriesSlice";
import { changeNoteCategory, getNote } from "@/slicers/notesSlice";

import { defaultCategory } from "@/configs/default";
import { COLOR, FONT, FONTSIZE, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function ChangeCategoryScreen() {
  const { t } = useTranslation();

  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const currentNote = useSelector(getNote(noteId));

  const [selectedCategory, setSelectedCategory] = useState(currentNote?.category || defaultCategory);
  const categories = useSelector(getCategories);

  const router = useRouter();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!currentNote) {
      router.back();
    }
  }, [currentNote, router]);

  const toggleCategory = useCallback((_selectedCategory: Category) => {
    setSelectedCategory((prevCategory: Category) => {
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
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("changecategory.title")}</Text>

        {selectedCategory ? (
          <TouchableOpacity activeOpacity={0.7} onPress={updateExistentCategory}>
            <IconChip>
              <CheckIcon size={20} color={COLOR.softWhite} />
            </IconChip>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
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
    width: SIZE.full,
  },
  headerTitle: {
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
    flexGrow: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 42,
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: SIZE.full,
  },
});
