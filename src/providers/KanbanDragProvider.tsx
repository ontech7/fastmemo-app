import type { KanbanColumn, KanbanItem } from "@/types";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { ScrollView } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

interface ColumnPosition {
  id: string;
  x: number;
  width: number;
}

interface KanbanDragContextValue {
  draggedItem: KanbanItem | null;
  sourceColumnId: string | null;
  targetColumnId: string | null;
  isDragging: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  startFingerX: SharedValue<number>;
  startFingerY: SharedValue<number>;
  containerOffsetX: SharedValue<number>;
  containerOffsetY: SharedValue<number>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  startDrag: (item: KanbanItem, columnId: string, absoluteX: number, absoluteY: number, cardX?: number, cardY?: number) => void;
  updateDragPosition: (absoluteX: number, absoluteY: number) => void;
  endDrag: (absoluteX: number, absoluteY: number) => void;
  cancelDrag: () => void;
  registerColumnPosition: (columnId: string, x: number, width: number) => void;
  getTargetColumn: (absoluteX: number) => string | null;
  updateScrollOffset: (offset: number) => void;
  setOverlayOffset: (x: number, y: number) => void;
  columnWidth: number;
  columnGap: number;
  scrollViewRef: RefObject<ScrollView | null>;
}

interface KanbanDragProviderProps {
  children: ReactNode;
  columns: KanbanColumn[];
  onMoveCard: (itemId: string, sourceColumnId: string, targetColumnId: string, dropIndex: number) => void;
  onReorderCards: (columnId: string, newItems: KanbanItem[]) => void;
  scrollViewRef: RefObject<ScrollView | null>;
  columnWidth: number;
  columnGap: number;
}

const KanbanDragContext = createContext<KanbanDragContextValue | null>(null);

export default function KanbanDragProvider({
  children,
  columns,
  onMoveCard,
  onReorderCards,
  scrollViewRef,
  columnWidth,
  columnGap,
}: KanbanDragProviderProps) {
  const [draggedItem, setDraggedItem] = useState<KanbanItem | null>(null);
  const [sourceColumnId, setSourceColumnId] = useState<string | null>(null);
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const containerOffsetX = useSharedValue(0);
  const containerOffsetY = useSharedValue(0);

  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);

  const startFingerX = useSharedValue(0);
  const startFingerY = useSharedValue(0);

  const startCardX = useSharedValue(0);
  const startCardY = useSharedValue(0);

  const columnPositionsRef = useRef<ColumnPosition[]>([]);
  const lastTargetColumnRef = useRef<string | null>(null);

  const scrollOffsetRef = useRef(0);

  const updateScrollOffset = useCallback((offset: number) => {
    scrollOffsetRef.current = offset;
  }, []);

  const registerColumnPosition = useCallback((columnId: string, x: number, width: number) => {
    const contentX = x + scrollOffsetRef.current;
    columnPositionsRef.current = columnPositionsRef.current.filter((c) => c.id !== columnId);
    columnPositionsRef.current.push({ id: columnId, x: contentX, width });
    columnPositionsRef.current.sort((a, b) => a.x - b.x);
  }, []);

  const startDrag = useCallback(
    (item: KanbanItem, columnId: string, absoluteX: number, absoluteY: number, cardX: number = 0, cardY: number = 0) => {
      setDraggedItem(item);
      setSourceColumnId(columnId);
      setIsDragging(true);

      startFingerX.value = absoluteX;
      startFingerY.value = absoluteY;

      fingerX.value = absoluteX;
      fingerY.value = absoluteY;

      startCardX.value = cardX;
      startCardY.value = cardY;

      dragX.value = cardX;
      dragY.value = cardY;
    },
    []
  );

  const updateDragPosition = useCallback((absoluteX: number, absoluteY: number) => {
    const deltaX = absoluteX - startFingerX.value;
    const deltaY = absoluteY - startFingerY.value;

    dragX.value = startCardX.value + deltaX;
    dragY.value = startCardY.value + deltaY;

    fingerX.value = absoluteX;
    fingerY.value = absoluteY;

    // calculate target column based on finger position
    const contentX = absoluteX + scrollOffsetRef.current;
    let newTargetColumnId: string | null = null;

    for (const col of columnPositionsRef.current) {
      if (contentX >= col.x && contentX <= col.x + col.width) {
        newTargetColumnId = col.id;
        break;
      }
    }

    // only update state if target changed to avoid unnecessary re-renders
    if (newTargetColumnId !== lastTargetColumnRef.current) {
      lastTargetColumnRef.current = newTargetColumnId;
      setTargetColumnId(newTargetColumnId);
    }
  }, []);

  const getTargetColumn = useCallback(
    (absoluteX: number): string | null => {
      const contentX = absoluteX + scrollOffsetRef.current;

      for (const col of columnPositionsRef.current) {
        if (contentX >= col.x && contentX <= col.x + col.width) {
          return col.id;
        }
      }

      if (columnPositionsRef.current.length > 0) {
        const lastCol = columnPositionsRef.current[columnPositionsRef.current.length - 1];
        if (contentX > lastCol.x + lastCol.width) {
          return lastCol.id;
        }
        const firstCol = columnPositionsRef.current[0];
        if (contentX < firstCol.x) {
          return firstCol.id;
        }
      }

      return sourceColumnId;
    },
    [sourceColumnId]
  );

  const getDropIndex = useCallback(
    (columnId: string, absoluteY: number, itemHeight: number = 60): number => {
      const column = columns.find((c) => c.id === columnId);
      if (!column) return 0;

      const headerHeight = 120;
      const cardSpacing = 8;
      const relativeY = absoluteY - headerHeight;
      const effectiveItemHeight = itemHeight + cardSpacing;
      const index = Math.max(0, Math.floor(relativeY / effectiveItemHeight));

      return Math.min(index, column.items.length);
    },
    [columns]
  );

  const endDrag = useCallback(
    (absoluteX: number, absoluteY: number) => {
      if (!draggedItem || !sourceColumnId) {
        setIsDragging(false);
        setDraggedItem(null);
        setSourceColumnId(null);
        setTargetColumnId(null);
        lastTargetColumnRef.current = null;
        return;
      }

      const targetColId = getTargetColumn(absoluteX);

      if (targetColId) {
        const dropIndex = getDropIndex(targetColId, absoluteY);

        if (targetColId === sourceColumnId) {
          const column = columns.find((c) => c.id === sourceColumnId);
          if (column) {
            const currentIndex = column.items.findIndex((item) => item.id === draggedItem.id);
            if (currentIndex !== -1 && currentIndex !== dropIndex) {
              const newItems = [...column.items];
              newItems.splice(currentIndex, 1);
              const adjustedIndex = dropIndex > currentIndex ? dropIndex - 1 : dropIndex;
              newItems.splice(Math.min(adjustedIndex, newItems.length), 0, draggedItem);
              onReorderCards(sourceColumnId, newItems);
            }
          }
        } else {
          onMoveCard(draggedItem.id, sourceColumnId, targetColId, dropIndex);
        }
      }

      setIsDragging(false);
      setDraggedItem(null);
      setSourceColumnId(null);
      setTargetColumnId(null);
      lastTargetColumnRef.current = null;
    },
    [draggedItem, sourceColumnId, columns, getTargetColumn, getDropIndex, onMoveCard, onReorderCards]
  );

  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    setDraggedItem(null);
    setSourceColumnId(null);
    setTargetColumnId(null);
    lastTargetColumnRef.current = null;
  }, []);

  const setOverlayOffset = useCallback((x: number, y: number) => {
    containerOffsetX.value = x || 0;
    containerOffsetY.value = y || 0;
  }, []);

  const value: KanbanDragContextValue = {
    draggedItem,
    sourceColumnId,
    targetColumnId,
    isDragging,
    dragX,
    dragY,
    startFingerX,
    startFingerY,
    containerOffsetX,
    containerOffsetY,
    fingerX,
    fingerY,

    startDrag,
    updateDragPosition,
    endDrag,
    cancelDrag,
    registerColumnPosition,
    getTargetColumn,
    updateScrollOffset,
    setOverlayOffset,

    columnWidth,
    columnGap,
    scrollViewRef,
  };

  return <KanbanDragContext.Provider value={value}>{children}</KanbanDragContext.Provider>;
}

export function useKanbanDrag(): KanbanDragContextValue {
  const context = useContext(KanbanDragContext);
  if (!context) {
    throw new Error("useKanbanDrag must be used within a KanbanDragProvider");
  }
  return context;
}
