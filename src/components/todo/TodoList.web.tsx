import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";

import ReorderOverlay from "@/components/reorder/ReorderOverlay";
import ReorderSlot from "@/components/reorder/ReorderSlot";
import { useReorderContainer } from "@/components/reorder/useReorderContainer";
import { LIST_CONTAINER, TodoItemStatic } from "@/components/todo/TodoItem";
import { PADDING_MARGIN } from "@/constants/styles";
import ReorderProvider, { useReorder, useReorderPreview } from "@/providers/ReorderProvider";

import type { TodoItem } from "@/types";
import type { RowDrag, TodoListProps } from "@/components/todo/TodoList";

const NO_DRAG: RowDrag = { folded: false, slotHeight: 0 };

/** The row in the air, as the engine's layer draws it. */
const renderLiftedRow = (item: TodoItem, height: number | undefined) => <TodoItemStatic item={item} height={height} />;

/*
 * A list's rows, reordered by the shared engine (ADR-038): one container, in a scroll view (the web keeps every row
 * mounted, as before).
 */
export default function TodoList({ list, renderRow, moveItemTo }: TodoListProps) {
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
      <TodoListRows list={list} renderRow={renderRow} />
    </ReorderProvider>
  );
}

function TodoListRows({ list, renderRow }: Pick<TodoListProps, "list" | "renderRow">) {
  const preview = useReorderPreview();
  const { registerFrame } = useReorder();

  // The list's box: the frame and its only container's area, measured by the engine at lift.
  const frameRef = useRef<ViewInstance>(null);
  useEffect(() => registerFrame(frameRef), [registerFrame]);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { scrollHandler, onContentSizeChange, onLayout } = useReorderContainer(LIST_CONTAINER, {
    scrollRef,
    areaRef: frameRef,
  });

  // While a row is in the air: its own place folded, and the slot above the row at that slot (among the rows without
  // it) or after the last one. The rows keep their order: a row hosts the slot, nothing is inserted among them.
  const sourceIndex = preview ? list.findIndex((item) => item.id === preview.sourceItemId) : -1;
  let shown = 0;
  const rows = list.map((item, index) => {
    if (!preview) return renderRow(item, index, NO_DRAG);
    const folded = index === sourceIndex;
    const slotHeight = !folded && shown === preview.targetIndex ? preview.height : 0;
    if (!folded) shown++;
    return renderRow(item, index, folded || slotHeight ? { folded, slotHeight } : NO_DRAG);
  });
  const trailingSlot = preview && preview.targetIndex >= shown ? preview.height : 0;

  return (
    <View ref={frameRef} style={styles.frame} onLayout={onLayout}>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.list}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
      >
        {rows}
        {trailingSlot ? <ReorderSlot height={trailingSlot} /> : null}
      </Animated.ScrollView>
      <ReorderOverlay renderLifted={renderLiftedRow} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    marginTop: PADDING_MARGIN.xl,
  },
  list: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
  },
});
