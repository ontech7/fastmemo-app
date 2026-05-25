import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";

import { getNotesSizePerCategory } from "@/slicers/notesSlice";
import CategoryIcon from "@/components/CategoryIcon";

import type { Category } from "@/types";

interface OrderedCategories {
  reorganizedCategoryList: Category[];
  notNumberedCategoryList: Category[];
}

interface Props {
  category: Category;
  order: number;
  notNumbered?: boolean;
  editMode: boolean;
  orderedCategories: OrderedCategories;
  setOrderedCategories: (categories: OrderedCategories) => void;
}

export default function OrganizeCategoryCard({
  category,
  order,
  notNumbered = false,
  editMode,
  orderedCategories,
  setOrderedCategories,
}: Props) {
  const { t } = useTranslation();

  const router = useRouter();

  const { name, icon } = category;

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
        activeOpacity={0.7}
        onPress={() => {
          if (!editMode) {
            navigateToCreateCategory();
          } else {
            organizeCategories();
          }
        }}
      >
        <View style={styles.categoryWrapper}>
          <CategoryIcon name={icon} color={COLOR.textPrimary} />

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
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  categoryPosition_wrapper: {
    position: "absolute",
    top: -6,
    left: -6,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.bg,
    borderWidth: 2,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.xs,
  },
  categoryPosition: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
  categoryWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryName: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.textPrimary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.paragraph,
  },
  numberOfNotesWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "flex-end",
    gap: PADDING_MARGIN.sm,
  },
  textNumberOfNotes: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  numberOfNotes_wrapper: {
    backgroundColor: COLOR.bgElevated,
    borderRadius: BORDER.rounded,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
  },
  numberOfNotes: {
    color: COLOR.textSecondary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    minWidth: 10,
    textAlign: "center",
  },
});
