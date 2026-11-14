import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from "react";
import { FlatList, StyleSheet, View, type ListRenderItemInfo, type ViewInstance } from "react-native";
import { useAnimatedRef } from "react-native-reanimated";

import ReorderOverlay from "@/components/reorder/ReorderOverlay";
import ReorderSlot from "@/components/reorder/ReorderSlot";
import { ReorderFlatList } from "@/components/reorder/scrollViews";
import { useReorderContainer } from "@/components/reorder/useReorderContainer";
import { LIST_CONTAINER, TodoItemStatic } from "@/components/todo/TodoItem";
import { PADDING_MARGIN } from "@/constants/styles";
import ReorderProvider, { useReorder, useReorderPreview } from "@/providers/ReorderProvider";

import type { TodoItem } from "@/types";

/**
 * What a row shows while a row is in the air (ADR-038): its place folded, or the slot above it. Only the rows whose
 * state changes render again: on a 300-row list, a prop every row shares froze the lift and the drop.
 */
export interface RowDrag {
  folded: boolean;
  slotHeight: number;
}

interface Props {
  list: TodoItem[];
  /** Draws a row; `drag` changes only while a row is in the air. */
  renderRow: (item: TodoItem, index: number, drag: RowDrag) => ReactElement;
  /** Moves a row (a drop or a keyboard move): `toIndex` counts it where it still is (moveById). */
  moveItemTo: (itemId: string, toIndex: number) => void;
  /** Under the last row (the line of the hidden completed items). */
  footer?: ReactElement | null;
}

export type { Props as TodoListProps };

const NO_DRAG: RowDrag = { folded: false, slotHeight: 0 };

/** The row in the air, as the engine's layer draws it. */
const renderLiftedRow = (item: TodoItem, height: number | undefined) => <TodoItemStatic item={item} height={height} />;

const keyExtractor = (item: TodoItem) => item.id;

/*
 * A list's rows, reordered by the shared engine (ADR-038): one container. The rows stay in a FlatList (a long list opens
 * as fast as before); rows mounted when a row is lifted are measured then, and are the possible targets.
 */
export default function TodoList({ list, renderRow, moveItemTo, footer }: Props) {
  // The list as it is now, read by the drag at lift: a ref, so a keystroke doesn't render the engine.
  const containersRef = useRef([{ id: LIST_CONTAINER, items: list }]);
  useLayoutEffect(() => {
    containersRef.current = [{ id: LIST_CONTAINER, items: list }];
  }, [list]);

  const onDrop = useCallback(
    (itemId: string, _from: string, _to: string, toIndex: number) => moveItemTo(itemId, toIndex),
    [moveItemTo]
  );

  return (
    <ReorderProvider containersRef={containersRef} onDrop={onDrop}>
      <TodoListRows list={list} renderRow={renderRow} footer={footer} />
    </ReorderProvider>
  );
}

function TodoListRows({ list, renderRow, footer }: Pick<Props, "list" | "renderRow" | "footer">) {
  const preview = useReorderPreview();
  const { registerFrame } = useReorder();

  // The list's box: the frame and its only container's area, measured by the engine at lift.
  const frameRef = useRef<ViewInstance>(null);
  useEffect(() => registerFrame(frameRef), [registerFrame]);
  const listRef = useAnimatedRef<FlatList<TodoItem>>();
  const { scrollHandler, onContentSizeChange, onLayout, scrollEnabled } = useReorderContainer(LIST_CONTAINER, {
    scrollRef: listRef,
    areaRef: frameRef,
  });

  // While a row is in the air: its own place folded, and the slot above the row at that slot (among the rows without
  // it) or after the last one. The rows keep their order: a row hosts the slot, nothing is inserted among them.
  const sourceIndex = useMemo(
    () => (preview ? list.findIndex((item) => item.id === preview.sourceItemId) : -1),
    [preview, list]
  );
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TodoItem>) => {
      if (!preview) return renderRow(item, index, NO_DRAG);
      const folded = index === sourceIndex;
      const shown = sourceIndex !== -1 && index > sourceIndex ? index - 1 : index;
      const slotHeight = !folded && shown === preview.targetIndex ? preview.height : 0;
      return renderRow(item, index, folded || slotHeight ? { folded, slotHeight } : NO_DRAG);
    },
    [renderRow, preview, sourceIndex]
  );
  const shownCount = list.length - (sourceIndex !== -1 ? 1 : 0);
  const trailingSlot = preview && preview.targetIndex >= shownCount ? preview.height : 0;

  return (
    <View ref={frameRef} style={styles.frame} onLayout={onLayout}>
      <ReorderFlatList
        ref={listRef}
        data={list}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={preview}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onScroll={scrollHandler}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        // Android's FlatList detaches the rows scrolled out of view: the lifted row's place (where its gesture runs) went
        // with them as the edge scroll moved the list, and the drag ended as cancelled.
        removeClippedSubviews={false}
        // A tap on a checkbox or a button acts at once with the keyboard up; a tap on empty space still closes it.
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          trailingSlot || footer ? (
            <>
              {trailingSlot ? <ReorderSlot height={trailingSlot} /> : null}
              {footer}
            </>
          ) : null
        }
      />
      <ReorderOverlay renderLifted={renderLiftedRow} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  listContent: {
    paddingTop: PADDING_MARGIN.xl,
    paddingBottom: PADDING_MARGIN.md,
  },
});
