import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon, PencilSquareIcon, XMarkIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import type { Category } from "@/types";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SafeAreaView from "@/components/SafeAreaView";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN, SIZE } from "@/constants/styles";

import AddCategoryButton from "@/components/buttons/AddCategoryButton";
import BackButton from "@/components/buttons/BackButton";
import OrganizeCategoryList from "@/components/lists/OrganizeCategoryList";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { getCategories, setCategories } from "@/slicers/categoriesSlice";

export default function OrganizeCategoriesScreen() {
  const { t } = useTranslation();

  const categories = useSelector(getCategories);

  const dispatch = useDispatch();

  const [isEditMode, setIsEditMode] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState<{
    reorganizedCategoryList: Category[];
    notNumberedCategoryList: Category[];
  }>({
    reorganizedCategoryList: categories,
    notNumberedCategoryList: [],
  });

  const undoCategoryOrganization = () => {
    setOrderedCategories({
      reorganizedCategoryList: categories,
      notNumberedCategoryList: [],
    });
    setIsEditMode(false);
  };

  const [showFinishOrganizeDialog, setShowFinishOrganizeDialog] = useState(false);

  const saveCategoryOrganization = () => {
    if (orderedCategories.notNumberedCategoryList.length == 0) {
      const orderedList = [...orderedCategories.reorganizedCategoryList];
      for (let i = 0; i < orderedList.length; i++) {
        orderedList[i] = { ...orderedList[i], order: i };
      }
      dispatch(setCategories({ categories: orderedList, reorder: true }));
      setIsEditMode(false);
    } else {
      setShowFinishOrganizeDialog(true);
    }
  };

  // hardware back for resetting editMode
  useEffect(() => {
    const backAction = () => {
      if (isEditMode) {
        setIsEditMode(false);
        return true;
      }

      return false;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [isEditMode]);

  useEffect(() => {
    setOrderedCategories({
      reorganizedCategoryList: categories,
      notNumberedCategoryList: [],
    });
    setIsEditMode(false);
  }, [categories]);

  return (
    <>
      <ConfirmOrCancelDialog
        open={showFinishOrganizeDialog}
        description={t("popup.finish_organize_categories")}
        onConfirm={() => setShowFinishOrganizeDialog(false)}
      />

      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip />

          {isEditMode && <View style={styles.editSpacer} />}

          <Text style={styles.headerTitle}>{t("organizecategory.title")}</Text>

          {isEditMode ? (
            <View style={styles.headerActions}>
              <TouchableOpacity activeOpacity={0.7} onPress={undoCategoryOrganization}>
                <IconChip>
                  <XMarkIcon size={20} color={COLOR.softWhite} />
                </IconChip>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={saveCategoryOrganization}>
                <IconChip>
                  <CheckIcon size={20} color={COLOR.softWhite} />
                </IconChip>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsEditMode(true)}>
              <IconChip>
                <PencilSquareIcon size={20} color={COLOR.softWhite} />
              </IconChip>
            </TouchableOpacity>
          )}
        </View>

        <OrganizeCategoryList
          orderedCategories={orderedCategories}
          setOrderedCategories={setOrderedCategories}
          editMode={isEditMode}
        />

        {!isEditMode && <AddCategoryButton />}
      </SafeAreaView>
    </>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  editSpacer: {
    width: 50,
  },
  headerTitle: {
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
    flexGrow: 1,
    textAlign: "center",
  },
});
