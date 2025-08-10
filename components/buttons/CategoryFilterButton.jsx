import React, { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { XMarkIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { popupAlert } from "@/utils/alert";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { deleteCategory, swapCategory } from "../../slicers/categoriesSlice";
import { deleteNotesCategory, resetNotesCategory } from "../../slicers/notesSlice";
import { selectorWebhook_deleteCategory } from "../../slicers/settingsSlice";
import CategoryIcon from "../CategoryIcon";

function CategoryFilterButton({ name, index, icon, selected, deleteMode, toggleDeleteMode }) {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const webhook_deleteCategory = useSelector(selectorWebhook_deleteCategory);

  /* anim */

  const rotateCategoryAnim = useRef(new Animated.Value(0)).current;

  const rotateCategoryInterpolation = rotateCategoryAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: ["0deg", "5deg", "0deg", "-5deg", "0deg"],
  });

  const animLoop = Animated.loop(
    Animated.timing(rotateCategoryAnim, {
      toValue: 4,
      duration: 300,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );

  const rotateCategoryEvent = () => {
    if (deleteMode) animLoop.start(() => rotateCategoryAnim.setValue(0));
    else {
      animLoop.reset();
    }
  };

  useEffect(() => {
    rotateCategoryEvent();
  }, [deleteMode]);

  /* events */

  const swapFavoriteCategory = () => {
    dispatch(swapCategory({ name, index, icon, selected }));
  };

  const deleteFavoriteCategory = () => {
    popupAlert(
      t("warning"),
      t("popup.delete_category"),
      {
        confirmText: t("delete_and_move"),
        confirmHandler: () => {
          dispatch(deleteCategory({ name, index, icon, selected }));
          dispatch(resetNotesCategory(icon));
          webhook(webhook_deleteCategory, {
            action: "note/deleteCategory",
            iconId: icon,
          });
          toggleDeleteMode();
        },
      },
      {
        alternateText: t("delete_with_notes"),
        alternateHandler: () => {
          dispatch(deleteCategory({ name, index, icon, selected }));
          dispatch(deleteNotesCategory(icon));
          webhook(webhook_deleteCategory, {
            action: "category/deleteCategory",
            iconId: icon,
          });
          toggleDeleteMode();
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          selected && styles.selectedButton,
          {
            transform: [
              {
                rotate: deleteMode ? rotateCategoryInterpolation : "0deg",
              },
            ],
          },
        ]}
        onPress={swapFavoriteCategory}
        onLongPress={toggleDeleteMode}
      >
        {index ? (
          <Text style={[styles.all, selected && styles.selectedAll]}>ALL</Text>
        ) : (
          <CategoryIcon name={icon} color={selected ? COLOR.darkBlue : COLOR.softWhite} />
        )}
      </TouchableOpacity>

      {selected && <View style={styles.selectedTriangle}></View>}

      {!index && deleteMode && (
        <TouchableOpacity style={styles.deleteButton} onPress={deleteFavoriteCategory}>
          <XMarkIcon size={14} color={COLOR.softWhite} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "relative",
    paddingHorizontal: PADDING_MARGIN.md,
    paddingTop: PADDING_MARGIN.sm,
  },
  all: {
    height: 28,
    paddingVertical: 3.5,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  selectedAll: {
    color: COLOR.darkBlue,
  },
  button: {
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.lightBlue,
  },
  selectedTriangle: {
    position: "absolute",
    right: 0,
    top: 23,
    borderStyle: "solid",
    borderTopWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 0,
    borderRightColor: COLOR.darkBlue,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  deleteButton: {
    position: "absolute",
    right: 5,
    top: 0,
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.rounded,
    padding: PADDING_MARGIN.xs,
  },
});

export default memo(CategoryFilterButton);
