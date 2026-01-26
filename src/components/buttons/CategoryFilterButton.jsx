import React, { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ExclamationTriangleIcon, XMarkIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { deleteCategory, swapCategory } from "../../slicers/categoriesSlice";
import { deleteNotesCategory, resetNotesCategory } from "../../slicers/notesSlice";
import { selectorWebhook_deleteCategory } from "../../slicers/settingsSlice";
import CategoryIcon from "../CategoryIcon";
import ComplexDialog from "../dialogs/ComplexDialog";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function CategoryFilterButton({ name, index, icon, selected, deleteMode, toggleDeleteMode }) {
  const { t } = useTranslation();

  const [showDeleteFavoriteCategoryDialog, setShowDeleteFavoriteCategoryDialog] = useState(false);

  const dispatch = useDispatch();

  const webhook_deleteCategory = useSelector(selectorWebhook_deleteCategory);

  const swapFavoriteCategory = () => {
    dispatch(swapCategory({ name, index, icon, selected }));
  };

  /* animation */

  const rotate = useSharedValue(0);

  const rotateAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  useEffect(() => {
    if (deleteMode) {
      rotate.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 75, easing: Easing.linear }),
          withTiming(5, { duration: 75, easing: Easing.linear }),
          withTiming(0, { duration: 75, easing: Easing.linear }),
          withTiming(-5, { duration: 75, easing: Easing.linear })
        ),
        -1,
        true
      );
    } else {
      rotate.value = withTiming(0);
    }
  }, [deleteMode]);

  return (
    <>
      <ComplexDialog
        open={showDeleteFavoriteCategoryDialog}
        actionsColumn
        adornmentStart={<ExclamationTriangleIcon size={22} style={{ marginBottom: -3 }} />}
        title={t("warning")}
        description={t("popup.delete_category")}
        confirm={{
          label: t("delete_and_move"),
          handler: () => {
            dispatch(deleteCategory({ name, index, icon, selected }));
            dispatch(resetNotesCategory(icon));
            webhook(webhook_deleteCategory, {
              action: "note/deleteCategory",
              iconId: icon,
            });
            toggleDeleteMode();
            setShowDeleteFavoriteCategoryDialog(false);
          },
        }}
        cancel={{
          label: t("delete_with_notes"),
          handler: () => {
            dispatch(deleteCategory({ name, index, icon, selected }));
            dispatch(deleteNotesCategory(icon));
            webhook(webhook_deleteCategory, {
              action: "category/deleteCategory",
              iconId: icon,
            });
            toggleDeleteMode();
            setShowDeleteFavoriteCategoryDialog(false);
          },
        }}
        alternative={{
          label: t("cancel"),
          handler: () => setShowDeleteFavoriteCategoryDialog(false),
        }}
      />

      <View style={styles.container}>
        <AnimatedTouchableOpacity
          style={[styles.button, selected && styles.selectedButton, rotateAnimStyle]}
          activeOpacity={0.7}
          onPress={swapFavoriteCategory}
          onLongPress={toggleDeleteMode}
        >
          {index ? (
            <Text style={[styles.all, selected && styles.selectedAll]}>ALL</Text>
          ) : (
            <CategoryIcon name={icon} color={selected ? COLOR.darkBlue : COLOR.softWhite} />
          )}
        </AnimatedTouchableOpacity>

        {selected && <View style={styles.selectedTriangle}></View>}

        {!index && deleteMode && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.deleteButton}
            onPress={() => setShowDeleteFavoriteCategoryDialog(true)}
          >
            <XMarkIcon size={14} color={COLOR.softWhite} />
          </TouchableOpacity>
        )}
      </View>
    </>
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
    textAlign: "center",
    height: 28,
    paddingVertical: 4,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
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
