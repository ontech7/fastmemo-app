import React, { useCallback, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";
import { useRouter } from "@/hooks/useRouter";
import SafeAreaView from "@/components/SafeAreaView";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import BackButton from "../../components/buttons/BackButton";
import SaveButton from "../../components/buttons/SaveButton";
import UnusedCategoryButton from "../../components/buttons/UnusedCategoryButton";
import BaseInput from "../../components/inputs/BaseInput";
import { createCategory, getUnusedCategories, updateCategory } from "../../slicers/categoriesSlice";
import { changeNotesCategory } from "../../slicers/notesSlice";
import { selectorWebhook_createCategory, selectorWebhook_updateCategory } from "../../slicers/settingsSlice";

export default function CreateCategoryScreen() {
  const { t } = useTranslation();

  const { index, name, icon, selected, isUpdateCategory } = useLocalSearchParams();

  const webhook_createCategory = useSelector(selectorWebhook_createCategory);
  const webhook_updateCategory = useSelector(selectorWebhook_updateCategory);

  const headerTitle = !isUpdateCategory ? "createcategory.title_create" : "createcategory.title_update";

  const [categoryIcon, setCategoryIcon] = useState(icon || "");
  const [categoryName, setCategoryName] = useState(name || "");
  const unusedCategories = useSelector(getUnusedCategories(icon));

  const router = useRouter();

  const dispatch = useDispatch();

  const toggleCategoryIcon = useCallback((selectedCategoryIcon) => {
    setCategoryIcon((prevCategoryIcon) => {
      if (prevCategoryIcon == "" || prevCategoryIcon != selectedCategoryIcon) {
        return selectedCategoryIcon;
      } else {
        return "";
      }
    });
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
          name: name,
        },
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
        <View style={styles.header}>
          <BackButton />

          <Text style={styles.headerTitle}>{t(headerTitle)}</Text>

          <View style={{ padding: PADDING_MARGIN.md }}></View>
        </View>

        <ScrollView>
          <BaseInput
            label={t("createcategory.name_title")}
            placeholder={t("createcategory.name_placeholder")}
            value={categoryName}
            onChangeText={setCategoryName}
          />

          <Text style={styles.label}>{t("createcategory.icon_title")}</Text>

          <View style={styles.categoryList}>
            {unusedCategories.map(
              (cat) =>
                cat.name != "none" && (
                  <UnusedCategoryButton
                    key={cat.name}
                    name={cat.name}
                    selected={categoryIcon === cat.name}
                    toggleCategoryIcon={toggleCategoryIcon}
                  />
                )
            )}
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
    width: SIZE.full,
  },
  headerTitle: {
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    flexGrow: 1,
    textAlign: "center",
    marginRight: 24,
  },
  button: {
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.lightBlue,
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginRight: -PADDING_MARGIN.lg,
  },
  label: {
    color: COLOR.softWhite,
    marginBottom: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.subtitle,
  },
});
