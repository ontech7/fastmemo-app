import Haptics, { ImpactFeedbackStyle, NotificationFeedbackType } from "@/libs/haptics";
import { findDrop, isOwnPlace } from "@/libs/kanbanDrop";
import type { DropColumn, DropLayout, DropTarget, Rect } from "@/libs/kanbanDrop";
import { measureInWindow } from "@/libs/tourTargets";
import type { KanbanColumn, KanbanItem } from "@/types";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Keyboard } from "react-native";
import type { ViewInstance } from "react-native";
import { useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/*
 * The kanban drag (ADR-037). Nothing is measured until a card is lifted: then the board, every column's card area and
 * every card are measured in window coordinates, once, with the scroll offsets of that moment. During the drag only the
 * scroll moves them, so the UI thread finds the target from those rectangles (`findDrop`) at every frame, and JS is
 * called when the target column changes (a haptic) and at the end.
 */

const SPRING_BACK = { damping: 15, stiffness: 220 };
/** By then the spring is within about 1% of the way it had to go back. */
const SPRING_BACK_MS = 600;

export interface KanbanDragContextValue {
  /** 1 while a card is in the air. */
  active: SharedValue<number>;
  /** 1 while the lifted card springs back to its place (no target then). */
  returning: SharedValue<number>;
  draggedId: SharedValue<string | null>;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  /** Where the pointer holds the lifted card, from its top left corner. */
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  /** The lifted card's width as measured. */
  liftWidth: SharedValue<number>;
  target: SharedValue<DropTarget | null>;
  layout: SharedValue<DropLayout | null>;
  /** The lifted card's place in `layout`: column and index. */
  sourceColumn: SharedValue<number>;
  sourceIndex: SharedValue<number>;
  boardScrollX: SharedValue<number>;
  /**
   * Each column's scroll offset, by column id. By id, not by place: columns move and are deleted, and a column keeps its
   * scroll when it does.
   */
  columnScrollY: SharedValue<Record<string, number>>;
  /** Columns and cards make themselves measurable; nothing is measured until a lift. */
  registerColumn(columnId: string, node: { area: RefObject<ViewInstance | null> }): () => void;
  registerCard(columnId: string, cardId: string, node: RefObject<ViewInstance | null>): () => void;
  registerBoard(node: RefObject<ViewInstance | null>): void;
  /** Called from the handle's gesture, on the JS thread. */
  lift(item: KanbanItem, columnId: string, pointerX: number, pointerY: number): void;
  release(): void;
  cancel(): void;
}

export interface KanbanDragged {
  item: KanbanItem;
  columnId: string;
}

interface Props {
  children: ReactNode;
  /** Applies a drop. The editor does it on the board as it is at that moment (kanbanOps.moveCard). */
  onDrop: (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => void;
  /** The board's columns as they are now, read at lift only (a ref: a keystroke must not re-render the provider). */
  columnsRef: RefObject<KanbanColumn[]>;
  columnWidth: number;
}

const KanbanDragContext = createContext<KanbanDragContextValue | null>(null);
const KanbanDraggedContext = createContext<KanbanDragged | null>(null);
const KanbanColumnWidthContext = createContext(0);

export default function KanbanDragProvider({ children, onDrop, columnsRef, columnWidth }: Props) {
  const reducedMotion = useReducedMotion();

  const active = useSharedValue(0);
  const returning = useSharedValue(0);
  const draggedId = useSharedValue<string | null>(null);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const liftWidth = useSharedValue(0);
  const target = useSharedValue<DropTarget | null>(null);
  const layout = useSharedValue<DropLayout | null>(null);
  const sourceColumn = useSharedValue(-1);
  const sourceIndex = useSharedValue(-1);
  const boardScrollX = useSharedValue(0);
  const columnScrollY = useSharedValue<Record<string, number>>({});

  const [dragged, setDragged] = useState<KanbanDragged | null>(null);

  const boardRef = useRef<RefObject<ViewInstance | null> | null>(null);
  const columnAreas = useRef(new Map<string, RefObject<ViewInstance | null>>());
  const cards = useRef(new Map<string, Map<string, RefObject<ViewInstance | null>>>());
  // The drag in progress, for the JS side: which card, from where, and its box at lift.
  const dragRef = useRef<{ item: KanbanItem; columnId: string; box: Rect; lift: DropLayout } | null>(null);
  // A lift whose measures are still coming: a release before they arrive abandons it.
  const liftSeq = useRef(0);

  const onDropRef = useRef(onDrop);
  const reducedMotionRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    onDropRef.current = onDrop;
    reducedMotionRef.current = reducedMotion;
  }, [onDrop, reducedMotion]);

  const registerBoard = useCallback((node: RefObject<ViewInstance | null>) => {
    boardRef.current = node;
  }, []);

  const registerColumn = useCallback((columnId: string, node: { area: RefObject<ViewInstance | null> }) => {
    columnAreas.current.set(columnId, node.area);
    return () => {
      if (columnAreas.current.get(columnId) === node.area) columnAreas.current.delete(columnId);
    };
  }, []);

  const registerCard = useCallback((columnId: string, cardId: string, node: RefObject<ViewInstance | null>) => {
    let column = cards.current.get(columnId);
    if (!column) {
      column = new Map();
      cards.current.set(columnId, column);
    }
    column.set(cardId, node);
    return () => {
      const current = cards.current.get(columnId);
      if (current?.get(cardId) === node) current.delete(cardId);
    };
  }, []);

  const finish = useCallback(() => {
    liftSeq.current++;
    dragRef.current = null;
    active.set(0);
    returning.set(0);
    target.set(null);
    draggedId.set(null);
    setDragged(null);
  }, [active, returning, target, draggedId]);

  const lift = useCallback(
    (item: KanbanItem, columnId: string, x: number, y: number) => {
      if (dragRef.current || active.get() === 1) return;
      const seq = ++liftSeq.current;
      Haptics.impactAsync(ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();

      const order = columnsRef.current ?? [];
      const scrollX = boardScrollX.get();
      const scrollById = columnScrollY.get();

      const measureColumn = async (column: KanbanColumn) => {
        const area = await measureInWindow(columnAreas.current.get(column.id)?.current);
        if (!area) return null;
        const nodes = cards.current.get(column.id);
        const boxes = await Promise.all(
          (column.items ?? []).map(async (card) => ({ id: card.id, box: await measureInWindow(nodes?.get(card.id)?.current) }))
        );
        const measured = boxes.filter((b): b is { id: string; box: Rect } => b.box !== null);
        return {
          column: { id: column.id, area, cards: measured.map((b) => b.box) } as DropColumn,
          ids: measured.map((b) => b.id),
        };
      };

      Promise.all([measureInWindow(boardRef.current?.current), Promise.all(order.map(measureColumn))]).then(
        ([board, measuredColumns]) => {
          // Released before the measures came, or another lift started.
          if (seq !== liftSeq.current || !board) return;
          const kept = measuredColumns.filter((c): c is NonNullable<typeof c> => c !== null);
          const c = kept.findIndex((m) => m.column.id === columnId);
          const i = c === -1 ? -1 : kept[c].ids.indexOf(item.id);
          // The dragged card itself can't be measured: no drag.
          if (c === -1 || i === -1) {
            liftSeq.current++;
            return;
          }

          const dropLayout: DropLayout = {
            board,
            columns: kept.map((m) => m.column),
            boardScrollX: scrollX,
            columnScrollY: kept.map((m) => scrollById[m.column.id] ?? 0),
          };
          const box = kept[c].column.cards[i];
          dragRef.current = { item, columnId, box, lift: dropLayout };

          layout.set(dropLayout);
          sourceColumn.set(c);
          sourceIndex.set(i);
          grabX.set(x - box.x);
          grabY.set(y - box.y);
          liftWidth.set(box.width);
          // The pointer is the gesture's: it wrote it at activation and keeps writing it while the measures come.
          target.set(
            findDrop(
              dropLayout,
              { boardScrollX: scrollX, columnScrollY: dropLayout.columnScrollY },
              pointerX.get(),
              pointerY.get()
            )
          );
          draggedId.set(item.id);
          setDragged({ item, columnId });
          active.set(1);
        }
      );
    },
    [
      active,
      columnsRef,
      boardScrollX,
      columnScrollY,
      layout,
      sourceColumn,
      sourceIndex,
      grabX,
      grabY,
      liftWidth,
      pointerX,
      pointerY,
      target,
      draggedId,
    ]
  );

  /** The lifted card goes back to where its original is now (the board or its column may have scrolled), then away. */
  const springBack = useCallback(() => {
    const drag = dragRef.current;
    if (!drag || reducedMotionRef.current) {
      finish();
      return;
    }
    const c = sourceColumn.get();
    const dx = boardScrollX.get() - drag.lift.boardScrollX;
    const dy = (columnScrollY.get()[drag.columnId] ?? 0) - (drag.lift.columnScrollY[c] ?? 0);
    returning.set(1);
    target.set(null);
    // The spring settles slowly to the last fraction of a pixel, and the desktop's webview reports its end seconds late:
    // the card goes away once it is back in place, whichever comes first, and only if it is still this drag.
    const seq = liftSeq.current;
    const done = () => {
      if (liftSeq.current === seq) finish();
    };
    setTimeout(done, SPRING_BACK_MS);
    pointerX.set(withSpring(drag.box.x - dx + grabX.get(), SPRING_BACK));
    pointerY.set(
      withSpring(drag.box.y - dy + grabY.get(), SPRING_BACK, () => {
        "worklet";
        scheduleOnRN(done);
      })
    );
  }, [finish, sourceColumn, boardScrollX, columnScrollY, returning, target, pointerX, pointerY, grabX, grabY]);

  const release = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      // Released before the lift's measures came: no drag.
      finish();
      return;
    }
    if (returning.get() === 1) return;
    const dropLayout = drag.lift;
    const dx = boardScrollX.get() - dropLayout.boardScrollX;
    const scrollById = columnScrollY.get();
    // The target as of the release, not as of the last frame.
    const now = findDrop(
      dropLayout,
      { boardScrollX: dropLayout.boardScrollX + dx, columnScrollY: dropLayout.columns.map((col) => scrollById[col.id] ?? 0) },
      pointerX.get(),
      pointerY.get()
    );
    if (!now || isOwnPlace(now, sourceColumn.get(), sourceIndex.get())) {
      springBack();
      return;
    }
    onDropRef.current(drag.item.id, drag.columnId, dropLayout.columns[now.column].id, now.index);
    Haptics.notificationAsync(NotificationFeedbackType.Success);
    finish();
  }, [finish, springBack, returning, boardScrollX, columnScrollY, pointerX, pointerY, sourceColumn, sourceIndex]);

  const cancel = useCallback(() => {
    if (!dragRef.current) {
      finish();
      return;
    }
    if (returning.get() === 1) return;
    springBack();
  }, [finish, springBack, returning]);

  // Never changes for the life of the board: every card and column reads it without rendering again.
  const value = useMemo<KanbanDragContextValue>(
    () => ({
      active,
      returning,
      draggedId,
      pointerX,
      pointerY,
      grabX,
      grabY,
      liftWidth,
      target,
      layout,
      sourceColumn,
      sourceIndex,
      boardScrollX,
      columnScrollY,
      registerColumn,
      registerCard,
      registerBoard,
      lift,
      release,
      cancel,
    }),
    [
      active,
      returning,
      draggedId,
      pointerX,
      pointerY,
      grabX,
      grabY,
      liftWidth,
      target,
      layout,
      sourceColumn,
      sourceIndex,
      boardScrollX,
      columnScrollY,
      registerColumn,
      registerCard,
      registerBoard,
      lift,
      release,
      cancel,
    ]
  );

  return (
    <KanbanDragContext.Provider value={value}>
      <KanbanColumnWidthContext.Provider value={columnWidth}>
        <KanbanDraggedContext.Provider value={dragged}>{children}</KanbanDraggedContext.Provider>
      </KanbanColumnWidthContext.Provider>
    </KanbanDragContext.Provider>
  );
}

export function useKanbanDrag(): KanbanDragContextValue {
  const context = useContext(KanbanDragContext);
  if (!context) {
    throw new Error("useKanbanDrag must be used within a KanbanDragProvider");
  }
  return context;
}

/** The card in the air and its column, or null. Changes at lift and drop: read by the overlay and the board only. */
export function useKanbanDragged(): KanbanDragged | null {
  return useContext(KanbanDraggedContext);
}

/** The board's column width, for the overlay's line. */
export function useKanbanColumnWidth(): number {
  return useContext(KanbanColumnWidthContext);
}
