import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon, PencilSquareIcon, XMarkIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import AddCategoryButton from "../../components/buttons/AddCategoryButton";
import BackButton from "../../components/buttons/BackButton";
import OrganizeCategoryList from "../../components/lists/OrganizeCategoryList";
import { getCategories, setCategories } from "../../slicers/categoriesSlice";

export default function OrganizeCategoriesScreen() {
  const { t } = useTranslation();

  const categories = useSelector(getCategories);

  const dispatch = useDispatch();

  const [isEditMode, setIsEditMode] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState({
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
      let orderedList = [...orderedCategories.reorganizedCategoryList];
      for (var i = 0; i < orderedList.length; i++) {
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
        <View style={styles.header}>
          <BackButton />

          {isEditMode && <View style={{ padding: PADDING_MARGIN.lg }} />}

          <Text style={styles.headerTitle}>{t("organizecategory.title")}</Text>

          {isEditMode ? (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                style={{ marginRight: PADDING_MARGIN.sm }}
                onPress={undoCategoryOrganization}
              >
                <XMarkIcon size={28} color={COLOR.softWhite} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={saveCategoryOrganization}>
                <CheckIcon size={28} color={COLOR.softWhite} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsEditMode(true)}>
              <PencilSquareIcon size={28} color={COLOR.softWhite} />
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
});
