import { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";
import { suggestIcons } from "@/utils/suggestIcons";
import { useRouter } from "@/hooks/useRouter";
import SafeAreaView from "@/components/SafeAreaView";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN, SIZE } from "@/constants/styles";

import AppBackground from "@/components/ui/AppBackground";
import BackButton from "@/components/buttons/BackButton";
import SaveButton from "@/components/buttons/SaveButton";
import UnusedCategoryButton from "@/components/buttons/UnusedCategoryButton";
import BaseInput from "@/components/inputs/BaseInput";
import { createCategory, getUnusedCategories, updateCategory } from "@/slicers/categoriesSlice";
import { changeNotesCategory } from "@/slicers/notesSlice";
import { selectorWebhook_createCategory, selectorWebhook_updateCategory } from "@/slicers/settingsSlice";

export default function CreateCategoryScreen() {
  const { t } = useTranslation();

  const { index, name, icon, selected, isUpdateCategory } = useLocalSearchParams<{
    index: string;
    name: string;
    icon: string;
    selected: string;
    isUpdateCategory: string;
  }>();

  const webhook_createCategory = useSelector(selectorWebhook_createCategory);
  const webhook_updateCategory = useSelector(selectorWebhook_updateCategory);

  const headerTitle = !isUpdateCategory ? "createcategory.title_create" : "createcategory.title_update";

  const [categoryIcon, setCategoryIcon] = useState(icon || "");
  const [categoryName, setCategoryName] = useState(name || "");

  // Build the selector once per `icon` (factory selectors must not be recreated every render).
  const unusedCategoriesSelector = useMemo(() => getUnusedCategories(icon), [icon]);
  const unusedCategories = useSelector(unusedCategoriesSelector);

  // Selectable icons, "none" placeholder excluded.
  const iconOptions = useMemo(() => unusedCategories.filter((cat) => cat.name !== "none"), [unusedCategories]);

  // Deterministic, offline icon suggestions derived from the typed name (7 languages).
  const suggestedIcons = useMemo(() => {
    const availableNames = iconOptions.map((cat) => cat.name);
    return suggestIcons(categoryName, availableNames);
  }, [categoryName, iconOptions]);

  const router = useRouter();

  const dispatch = useDispatch();

  const toggleCategoryIcon = useCallback((selectedCategoryIcon: string) => {
    // Tapping the selected icon again clears it; otherwise switch to the new one.
    setCategoryIcon((prevCategoryIcon) => (prevCategoryIcon === selectedCategoryIcon ? "" : selectedCategoryIcon));
  }, []);

  const saveNewCategory = () => {
    dispatch(
      createCategory({
        icon: categoryIcon,
        name: categoryName,
      })
    );
    webhook(webhook_createCategory, {
      action: "category/createCategory",
      iconId: categoryIcon,
      name: categoryName,
    });

    router.dismissAll();
  };

  const updateExistentCategory = () => {
    dispatch(
      changeNotesCategory({
        iconFrom: icon,
        iconTo: categoryIcon,
        nameTo: categoryName,
      })
    );
    dispatch(
      updateCategory({
        nextCategory: {
          icon: categoryIcon,
          name: categoryName,
        },
        prevCategory: {
          icon: icon,
          name: name ?? "",
          order: 0,
          index: index === "true",
          selected: selected === "true",
        },
        index: index === "true",
      })
    );
    webhook(webhook_updateCategory, {
      action: "category/updateCategory",
      nextCategory: {
        iconId: categoryIcon,
        name: categoryName,
      },
      prevCategory: {
        iconId: icon,
        name: name,
      },
    });

    router.back();
  };

  const onPressHandler = () => {
    if (!isUpdateCategory) {
      saveNewCategory();
    } else {
      updateExistentCategory();
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip />

          <Text style={styles.headerTitle}>{t(headerTitle)}</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView>
          <BaseInput
            label={t("createcategory.name_title")}
            placeholder={t("createcategory.name_placeholder")}
            value={categoryName}
            onChangeText={setCategoryName}
          />

          {suggestedIcons.length > 0 && (
            <>
              <Text style={styles.label}>{t("createcategory.suggested_title")}</Text>

              <View style={styles.categoryList}>
                {suggestedIcons.map((iconName) => (
                  <UnusedCategoryButton
                    key={iconName}
                    name={iconName}
                    selected={categoryIcon === iconName}
                    toggleCategoryIcon={toggleCategoryIcon}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>{t("createcategory.icon_title")}</Text>

          <View style={styles.categoryList}>
            {iconOptions.map((cat) => (
              <UnusedCategoryButton
                key={cat.name}
                name={cat.name}
                selected={categoryIcon === cat.name}
                toggleCategoryIcon={toggleCategoryIcon}
              />
            ))}
          </View>
        </ScrollView>

        {categoryIcon && categoryName && <SaveButton onPress={onPressHandler} />}
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    marginRight: -PADDING_MARGIN.lg,
  },
  label: {
    color: COLOR.textPrimary,
    marginBottom: PADDING_MARGIN.sm,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    letterSpacing: -0.2,
  },
});
