import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useDispatch } from "react-redux";

import { PADDING_MARGIN, SIZE } from "@/constants/styles";

import OrganizeCategoryCard, {
  CATEGORIES_CONTAINER,
  OrganizeCategoryCardStatic,
} from "@/components/cards/OrganizeCategoryCard";
import ReorderOverlay from "@/components/reorder/ReorderOverlay";
import EmptyState from "@/components/ui/EmptyState";
import ReorderSlot from "@/components/reorder/ReorderSlot";
import { ReorderScrollView } from "@/components/reorder/scrollViews";
import { useReorderContainer } from "@/components/reorder/useReorderContainer";
import ReorderProvider, { useReorder, useReorderPreview } from "@/providers/ReorderProvider";
import { categoryOrder, moveCategory } from "@/slicers/categoriesSlice";

import type { Category } from "@/types";

interface Props {
  categories: Category[];
}

/** A category as the reorder engine sees it: its icon is its id. */
type OrganizedCategory = Category & { id: string };

/** The category in the air, as the engine's layer draws it. */
const renderLiftedCategory = (category: OrganizedCategory, height: number | undefined) => (
  <OrganizeCategoryCardStatic category={category} height={height} />
);

/*
 * The Organize page's categories (ADR-038): "All" first, fixed; the others reorder by drag, each drop saved at once
 * (`moveCategory`), which also moves them in the home's category bar.
 */
export default function OrganizeCategoryList({ categories }: Props) {
  const dispatch = useDispatch();

  const sorted = useMemo(() => [...categories].sort(categoryOrder), [categories]);
  const indexCategory = sorted.find((category) => category.index);
  const others = useMemo<OrganizedCategory[]>(
    () => sorted.filter((category) => !category.index).map((category) => ({ ...category, id: category.icon })),
    [sorted]
  );

  // The categories as they are now, read by the drag at lift.
  const containersRef = useRef([{ id: CATEGORIES_CONTAINER, items: others }]);
  useLayoutEffect(() => {
    containersRef.current = [{ id: CATEGORIES_CONTAINER, items: others }];
  }, [others]);

  const onDrop = useCallback(
    (icon: string, _from: string, _to: string, toIndex: number) => dispatch(moveCategory({ icon, toIndex })),
    [dispatch]
  );

  // The handles' gestures need a gesture root around them on Android (the app has none at its root): without it a
  // finger on a handle did nothing.
  return (
    <GestureHandlerRootView style={styles.frame}>
      <ReorderProvider containersRef={containersRef} onDrop={onDrop}>
        <OrganizeRows indexCategory={indexCategory} others={others} />
      </ReorderProvider>
    </GestureHandlerRootView>
  );
}

function OrganizeRows({ indexCategory, others }: { indexCategory?: Category; others: OrganizedCategory[] }) {
  const preview = useReorderPreview();
  const { registerFrame } = useReorder();

  // The list's box: the frame and its only container's area, measured by the engine at lift.
  const frameRef = useRef<ViewInstance>(null);
  useEffect(() => registerFrame(frameRef), [registerFrame]);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { scrollHandler, onContentSizeChange, onLayout, scrollEnabled } = useReorderContainer(CATEGORIES_CONTAINER, {
    scrollRef,
    areaRef: frameRef,
  });

  // While a category is in the air: its own place folded, and the slot above the category at that slot (among the
  // others without it) or after the last one. The cards keep their order: a card hosts the slot.
  let shown = 0;
  const rows = others.map((category) => {
    const folded = category.id === preview?.sourceItemId;
    const slotHeight = preview && !folded && shown === preview.targetIndex ? preview.height : 0;
    if (!folded) shown++;
    return (
      <OrganizeCategoryCard
        key={category.id}
        category={category}
        folded={folded}
        slotHeight={slotHeight}
        animateLayout={preview !== null}
      />
    );
  });
  const trailingSlot = preview && preview.targetIndex >= shown ? preview.height : 0;

  return (
    <View ref={frameRef} style={styles.frame} onLayout={onLayout}>
      <ReorderScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[styles.content, others.length === 0 && styles.contentEmpty]}
      >
        {indexCategory && <OrganizeCategoryCard category={indexCategory} locked />}
        {rows}
        {trailingSlot ? <ReorderSlot height={trailingSlot} style={styles.slot} /> : null}

        {others.length === 0 && <EmptyState variant="categories" />}
      </ReorderScrollView>
      <ReorderOverlay renderLifted={renderLiftedCategory} />
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: SIZE.full,
  },
  // Room for the add button over the end of the list.
  content: {
    paddingBottom: 140,
  },
  // No category besides "All": the drawing takes the room left under it.
  contentEmpty: {
    flexGrow: 1,
  },
  slot: {
    marginBottom: PADDING_MARGIN.md,
    marginRight: 0,
  },
});
