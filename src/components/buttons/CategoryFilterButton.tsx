import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ExclamationTriangleIcon, Squares2X2Icon, XMarkIcon } from "react-native-heroicons/outline";
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

import { BORDER, COLOR, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import CategoryIcon from "@/components/CategoryIcon";
import ComplexDialog from "@/components/dialogs/ComplexDialog";
import { deleteCategory, swapCategory } from "@/slicers/categoriesSlice";
import { deleteNotesCategory, resetNotesCategory } from "@/slicers/notesSlice";
import { selectorWebhook_deleteCategory } from "@/slicers/settingsSlice";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface Props {
  name: string;
  index: boolean;
  icon: string;
  selected: boolean;
  deleteMode: boolean;
  toggleDeleteMode: () => void;
}

function CategoryFilterButton({ name, index, icon, selected, deleteMode, toggleDeleteMode }: Props) {
  const { t } = useTranslation();

  const [showDeleteFavoriteCategoryDialog, setShowDeleteFavoriteCategoryDialog] = useState(false);

  const dispatch = useDispatch();

  const webhook_deleteCategory = useSelector(selectorWebhook_deleteCategory);

  const swapFavoriteCategory = () => {
    dispatch(swapCategory({ icon }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteMode]);

  return (
    <>
      <ComplexDialog
        open={showDeleteFavoriteCategoryDialog}
        actionsColumn
        adornmentStart={<ExclamationTriangleIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
        title={t("warning")}
        description={t("popup.delete_category")}
        confirm={{
          label: t("delete_and_move"),
          handler: () => {
            dispatch(deleteCategory({ name, index, icon, selected, order: 0 }));
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
            dispatch(deleteCategory({ name, index, icon, selected, order: 0 }));
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
            <Squares2X2Icon size={24} color={COLOR.softWhite} />
          ) : (
            <CategoryIcon name={icon} size={24} color={COLOR.softWhite} />
          )}
        </AnimatedTouchableOpacity>

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
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.sm,
  },
  button: {
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
    ...SHADOW.glow,
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
