import React from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import { getNotesSizePerCategory } from "../../slicers/notesSlice";
import CategoryIcon from "../CategoryIcon";

export default function OrganizeCategoryCard({
  category,
  order,
  notNumbered = false,
  editMode,
  orderedCategories,
  setOrderedCategories,
}) {
  const { t } = useTranslation();

  const router = useRouter();

  const { name, icon, selected } = category;

  const notesSize = useSelector(getNotesSizePerCategory(category)); //TODO: memoize

  const navigateToCreateCategory = () => {
    router.push({
      pathname: "/categories/create",
      params: {
        name,
        icon,
        isUpdateCategory: "true",
      },
    });
  };

  const removeFromReorganizedCategoryList = () => {
    //TODO: adjust
    setOrderedCategories({
      reorganizedCategoryList: [
        ...orderedCategories.reorganizedCategoryList.slice(0, order),
        ...orderedCategories.reorganizedCategoryList.slice(order + 1),
      ],
      notNumberedCategoryList: [
        ...orderedCategories.reorganizedCategoryList.slice(order, order + 1),
        ...orderedCategories.notNumberedCategoryList,
      ],
    });
  };

  const addToReorganizedCategoryList = () => {
    //TODO: adjust
    setOrderedCategories({
      reorganizedCategoryList: [
        ...orderedCategories.reorganizedCategoryList,
        ...orderedCategories.notNumberedCategoryList.slice(order, order + 1),
      ],
      notNumberedCategoryList: [
        ...orderedCategories.notNumberedCategoryList.slice(0, order),
        ...orderedCategories.notNumberedCategoryList.slice(order + 1),
      ],
    });
  };

  const organizeCategories = () => {
    if (!notNumbered) {
      removeFromReorganizedCategoryList();
    } else {
      addToReorganizedCategoryList();
    }
  };

  return (
    <View style={styles.buttonWrapper}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (!editMode) {
            navigateToCreateCategory();
          } else {
            organizeCategories();
          }
        }}
      >
        <View style={styles.categoryWrapper}>
          <CategoryIcon name={icon} color={COLOR.softWhite} />

          <Text style={styles.categoryName}>{t(name)}</Text>
        </View>

        <View style={styles.numberOfNotesWrapper}>
          <Text style={styles.textNumberOfNotes}>{t("createcategory.notes_num")}</Text>

          <View style={styles.numberOfNotes_wrapper}>
            <Text style={styles.numberOfNotes}>{notesSize}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {!notNumbered && order && (
        <View style={styles.categoryPosition_wrapper}>
          <Text style={styles.categoryPosition}>{order}</Text>
        </View>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  buttonWrapper: {
    position: "relative",
    width: SIZE.full,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.lightBlue,
  },
  categoryPosition_wrapper: {
    position: "absolute",
    top: -5,
    left: -5,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.darkBlue,
    borderColor: COLOR.blue,
    borderWidth: 1,
    paddingHorizontal: PADDING_MARGIN.xs,
  },
  categoryPosition: {
    color: COLOR.softWhite,
    textAlign: "center",
    minWidth: 10,
  },
  categoryWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryName: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  numberOfNotesWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  textNumberOfNotes: {
    color: COLOR.softWhite,
    marginRight: PADDING_MARGIN.sm,
  },
  numberOfNotes_wrapper: {
    backgroundColor: COLOR.softWhite,
    borderRadius: BORDER.rounded,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
  },
  numberOfNotes: {
    color: COLOR.blue,
    fontWeight: FONTWEIGHT.semiBold,
    minWidth: 10,
    textAlign: "center",
  },
});
