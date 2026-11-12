import { LIFT } from "@/constants/styles";
import Haptics, { ImpactFeedbackStyle, NotificationFeedbackType } from "@/libs/haptics";
import { findDrop, isOwnPlace, toMoveIndex, withoutCard } from "@/libs/kanbanDrop";
import type { DropColumn, DropLayout, DropTarget, Rect } from "@/libs/kanbanDrop";
import { measureInWindow } from "@/libs/tourTargets";
import type { KanbanColumn, KanbanItem } from "@/types";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Keyboard } from "react-native";
import type { ViewInstance } from "react-native";
import { Easing, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/*
 * The kanban drag (ADR-037). Nothing is measured until a card is lifted: then the board, every column's card area and
 * every card are measured in window coordinates, once, with the scroll offsets of that moment, and the lifted card is
 * taken out of them (`withoutCard`). During the drag only the scroll moves them, so the UI thread finds the target from
 * those rectangles (`findDrop`) at every frame. JS hears when the target column changes (a haptic), when the slot
 * changes (the columns show it: the preview) and at the end, when the card settles into the slot.
 */

/** The drop lands quickly (the user, 2026-11-12: moving things in a row must not wait on it), easing out. */
const SETTLE = { duration: LIFT.dropMs, easing: Easing.out(Easing.cubic) };
/** The webview may report an animation's end late: the drag ends by then anyway. */
const SETTLE_MS = LIFT.dropMs + 60;

export interface KanbanDragContextValue {
  /** 1 while a card is in the air. */
  active: SharedValue<number>;
  /** 1 while the lifted card settles into its slot, at the end. */
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
  /** The slot shown in a column: where the lifted card settles at the end. */
  registerSlot(node: RefObject<ViewInstance | null>): () => void;
  /** The board's frame callback, when the slot under the pointer changes: column -1 is nowhere (its own place). */
  showTarget(column: number, index: number): void;
  /** Called from the handle's gesture, on the JS thread. */
  lift(item: KanbanItem, columnId: string, pointerX: number, pointerY: number): void;
  release(): void;
  cancel(): void;
}

export interface KanbanDragged {
  item: KanbanItem;
  columnId: string;
}

/**
 * What the columns show while a card is in the air: its own place folded (the card stays mounted: its gesture is
 * running) and a slot of its height where it would land. The same order the drop then commits, so the drop moves nothing.
 */
export interface KanbanPreview {
  sourceColumnId: string;
  sourceCardId: string;
  targetColumnId: string;
  /** A slot among the target column's cards without the lifted one. */
  targetIndex: number;
  height: number;
}

interface Props {
  children: ReactNode;
  /** Applies a drop. The editor does it on the board as it is at that moment (kanbanOps.moveCard). */
  onDrop: (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => void;
  /** The board's columns as they are now, read at lift only (a ref: a keystroke must not re-render the provider). */
  columnsRef: RefObject<KanbanColumn[]>;
}

const KanbanDragContext = createContext<KanbanDragContextValue | null>(null);
const KanbanDraggedContext = createContext<KanbanDragged | null>(null);
const KanbanPreviewContext = createContext<KanbanPreview | null>(null);

export default function KanbanDragProvider({ children, onDrop, columnsRef }: Props) {
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
  const [preview, setPreview] = useState<KanbanPreview | null>(null);
  const slotRef = useRef<RefObject<ViewInstance | null> | null>(null);

  const boardRef = useRef<RefObject<ViewInstance | null> | null>(null);
  const columnAreas = useRef(new Map<string, RefObject<ViewInstance | null>>());
  const cards = useRef(new Map<string, Map<string, RefObject<ViewInstance | null>>>());
  // The drag in progress, for the JS side: which card, from where (column, index), its box at lift, and the layout
  // measured then without it.
  const dragRef = useRef<{
    item: KanbanItem;
    columnId: string;
    column: number;
    index: number;
    box: Rect;
    lift: DropLayout;
  } | null>(null);
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

  const registerSlot = useCallback((node: RefObject<ViewInstance | null>) => {
    slotRef.current = node;
    return () => {
      if (slotRef.current === node) slotRef.current = null;
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
    setPreview(null);
  }, [active, returning, target, draggedId]);

  const showTarget = useCallback((column: number, index: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const to = column >= 0 ? drag.lift.columns[column] : undefined;
    const targetColumnId = to ? to.id : drag.columnId;
    const targetIndex = to ? index : drag.index;
    setPreview((p) =>
      !p || (p.targetColumnId === targetColumnId && p.targetIndex === targetIndex) ? p : { ...p, targetColumnId, targetIndex }
    );
  }, []);

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

          const measured: DropLayout = {
            board,
            columns: kept.map((m) => m.column),
            boardScrollX: scrollX,
            columnScrollY: kept.map((m) => scrollById[m.column.id] ?? 0),
          };
          const box = measured.columns[c].cards[i];
          // The lifted card's place closes while it is in the air: the target is found among the others.
          const dropLayout = withoutCard(measured, c, i);
          dragRef.current = { item, columnId, column: c, index: i, box, lift: dropLayout };

          layout.set(dropLayout);
          sourceColumn.set(c);
          sourceIndex.set(i);
          grabX.set(x - box.x);
          grabY.set(y - box.y);
          liftWidth.set(box.width);
          // The pointer is the gesture's: it wrote it at activation and keeps writing it while the measures come.
          const first = findDrop(
            dropLayout,
            { boardScrollX: scrollX, columnScrollY: dropLayout.columnScrollY },
            pointerX.get(),
            pointerY.get()
          );
          target.set(first);
          draggedId.set(item.id);
          setDragged({ item, columnId });
          setPreview({
            sourceColumnId: columnId,
            sourceCardId: item.id,
            targetColumnId: first ? dropLayout.columns[first.column].id : columnId,
            targetIndex: first ? first.index : i,
            height: box.height,
          });
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

  /**
   * The end of every drag: the lifted card springs into the slot the columns show (measured now: the board or its column
   * may have scrolled), then `done` runs, once, and only for this drag. Without motion, at once.
   */
  const settle = useCallback(
    (done: () => void) => {
      const seq = liftSeq.current;
      const once = () => {
        if (liftSeq.current === seq) done();
      };
      if (reducedMotionRef.current) {
        once();
        return;
      }
      returning.set(1);
      // One frame: the slot is laid out where the last target put it.
      requestAnimationFrame(() => {
        measureInWindow(slotRef.current?.current).then((slot) => {
          if (liftSeq.current !== seq) return;
          if (!slot) {
            once();
            return;
          }
          // The drag ends when the card is in the slot, or after SETTLE_MS, whichever comes first.
          setTimeout(once, SETTLE_MS);
          pointerX.set(withTiming(slot.x + grabX.get(), SETTLE));
          pointerY.set(
            withTiming(slot.y + grabY.get(), SETTLE, () => {
              "worklet";
              scheduleOnRN(once);
            })
          );
        });
      });
    },
    [returning, pointerX, pointerY, grabX, grabY]
  );

  const release = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      // Released before the lift's measures came: no drag.
      finish();
      return;
    }
    if (returning.get() === 1) return;
    const dropLayout = drag.lift;
    const scrollById = columnScrollY.get();
    // The target as of the release, not as of the last frame.
    const now = findDrop(
      dropLayout,
      { boardScrollX: boardScrollX.get(), columnScrollY: dropLayout.columns.map((col) => scrollById[col.id] ?? 0) },
      pointerX.get(),
      pointerY.get()
    );
    const moves = now !== null && !isOwnPlace(now, drag.column, drag.index);
    showTarget(moves ? now.column : -1, moves ? now.index : drag.index);
    settle(() => {
      if (moves) {
        // In the same React commit as the end of the preview: the order it showed becomes the board's.
        onDropRef.current(
          drag.item.id,
          drag.columnId,
          dropLayout.columns[now.column].id,
          toMoveIndex(now, drag.column, drag.index)
        );
        Haptics.notificationAsync(NotificationFeedbackType.Success);
      }
      finish();
    });
  }, [finish, settle, showTarget, returning, boardScrollX, columnScrollY, pointerX, pointerY]);

  const cancel = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      finish();
      return;
    }
    if (returning.get() === 1) return;
    showTarget(-1, drag.index);
    settle(finish);
  }, [finish, settle, showTarget, returning]);

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
      registerSlot,
      showTarget,
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
      registerSlot,
      showTarget,
      lift,
      release,
      cancel,
    ]
  );

  return (
    <KanbanDragContext.Provider value={value}>
      <KanbanDraggedContext.Provider value={dragged}>
        <KanbanPreviewContext.Provider value={preview}>{children}</KanbanPreviewContext.Provider>
      </KanbanDraggedContext.Provider>
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

/** The order the columns show while a card is in the air, or null. Changes at lift, when the slot moves, and at the end. */
export function useKanbanPreview(): KanbanPreview | null {
  return useContext(KanbanPreviewContext);
}
