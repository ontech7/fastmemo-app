import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View, type ViewInstance } from "react-native";
import LockClosedIcon from "react-native-heroicons/outline/LockClosedIcon";
import Squares2X2Icon from "react-native-heroicons/outline/Squares2X2Icon";
import Animated from "react-native-reanimated";
import { useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import CategoryIcon from "@/components/CategoryIcon";
import DragIcon from "@/components/icons/DragIcon";
import ReorderHandle from "@/components/reorder/ReorderHandle";
import ReorderSlot from "@/components/reorder/ReorderSlot";
import { useItemSlide } from "@/components/reorder/useItemSlide";
import { useReorder } from "@/providers/ReorderProvider";
import { getNotesCountByCategory } from "@/slicers/notesSlice";

import type { Category } from "@/types";

/** The Organize page's only container in the reorder engine. A category's id there is its icon. */
export const CATEGORIES_CONTAINER = "categories";

interface Props {
  category: Category;
  /** "All", the index category: first, and a lock where the handle is (it doesn't move). */
  locked?: boolean;
  /** The category in the air: its place folds away while it stays mounted (its gesture is the one running). */
  folded?: boolean;
  /** The slot of the category in the air opens above this one, this high. */
  slotHeight?: number;
  /** While a category is in the air: the cards slide to open the slot and close its place. */
  animateLayout?: boolean;
}

/*
 * A category on the Organize page: a tap opens its edit page, its handle drags it to a new place (ADR-038), saved at the
 * drop (`moveCategory`).
 */
function OrganizeCategoryCard({ category, locked = false, folded = false, slotHeight = 0, animateLayout = false }: Props) {
  const router = useRouter();
  const { name, icon } = category;

  // Measured by the reorder engine at lift only; "All" isn't a target.
  const { registerItem } = useReorder();
  const cardRef = useRef<ViewInstance>(null);
  useEffect(() => (locked ? undefined : registerItem(CATEGORIES_CONTAINER, icon, cardRef)), [registerItem, icon, locked]);
  const slide = useItemSlide(animateLayout);
  const item = useMemo(() => ({ ...category, id: category.icon }), [category]);

  const openEditPage = () => {
    router.push({
      pathname: "/categories/create",
      params: { name, icon, isUpdateCategory: "true" },
    });
  };

  return (
    <Animated.View layout={slide.box} style={folded && styles.folded}>
      {slotHeight ? <ReorderSlot height={slotHeight} style={styles.slot} /> : null}
      <Animated.View ref={cardRef} layout={slide.inner} style={styles.card}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={locked ? 1 : 0.7}
          disabled={locked}
          onPress={openEditPage}
          accessibilityRole="button"
        >
          <CategoryCardBody category={category} />
        </TouchableOpacity>

        {locked ? (
          <View style={styles.handle} aria-hidden focusable={false}>
            <LockClosedIcon size={20} color={COLOR.textMuted} />
          </View>
        ) : (
          <ReorderHandle item={item} containerId={CATEGORIES_CONTAINER} style={styles.handle} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

export default memo(OrganizeCategoryCard);

/** The icon, the name and how many notes the category holds. */
function CategoryCardBody({ category }: { category: Category }) {
  const { t } = useTranslation();
  const counts = useSelector(getNotesCountByCategory);
  const notesSize = category.index ? counts.total : (counts.byIcon[category.icon] ?? 0);

  return (
    <>
      <View style={styles.categoryWrapper}>
        {/* "All" shows the sidebar's icon, so its row reads as that button. */}
        {category.index ? (
          <Squares2X2Icon size={28} color={COLOR.textPrimary} />
        ) : (
          <CategoryIcon name={category.icon} color={COLOR.textPrimary} />
        )}
        <Text style={styles.categoryName}>{t(category.name)}</Text>
      </View>

      <View style={styles.numberOfNotesWrapper}>
        <Text style={styles.textNumberOfNotes}>{t("createcategory.notes_num")}</Text>
        <View style={styles.numberOfNotes_wrapper}>
          <Text style={styles.numberOfNotes}>{notesSize}</Text>
        </View>
      </View>
    </>
  );
}

interface OrganizeCategoryCardStaticProps {
  category: Category;
  /** The lifted card's measured height: drawn at exactly that size, it becomes the real card at the drop without a hop. */
  height?: number;
}

/** A category as the reorder engine's layer draws it in the air: read-only, raised (accent edge, shadow). */
export function OrganizeCategoryCardStatic({ category, height }: OrganizeCategoryCardStaticProps) {
  return (
    <View style={[styles.card, styles.cardLifted, height !== undefined && { height }]}>
      <View style={styles.button}>
        <CategoryCardBody category={category} />
      </View>
      <View style={styles.handle}>
        <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  // Its place closed, the card still mounted: nothing of it shows or takes room.
  folded: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  // A card's place: its gap below, and the card's full width (no delete button beside it).
  slot: {
    marginBottom: PADDING_MARGIN.md,
    marginRight: 0,
  },
  card: {
    width: SIZE.full,
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  cardLifted: {
    marginBottom: 0,
    borderColor: COLOR.accentSoft,
    ...SHADOW.lifted,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.md,
    paddingLeft: PADDING_MARGIN.md,
  },
  // The drag handle, or "All"'s lock in the same place.
  handle: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.md,
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
