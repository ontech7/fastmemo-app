import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

const KanbanDragContext = createContext(null);

export function KanbanDragProvider({ children, columns, onMoveCard, onReorderCards, scrollViewRef, columnWidth, columnGap }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [sourceColumnId, setSourceColumnId] = useState(null);
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

  const columnPositionsRef = useRef([]);

  const scrollOffsetRef = useRef(0);

  const updateScrollOffset = useCallback((offset) => {
    scrollOffsetRef.current = offset;
  }, []);

  const registerColumnPosition = useCallback((columnId, x, width) => {
    const contentX = x + scrollOffsetRef.current;
    columnPositionsRef.current = columnPositionsRef.current.filter((c) => c.id !== columnId);
    columnPositionsRef.current.push({ id: columnId, x: contentX, width });
    columnPositionsRef.current.sort((a, b) => a.x - b.x);
  }, []);

  const startDrag = useCallback((item, columnId, absoluteX, absoluteY, cardX = 0, cardY = 0) => {
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
  }, []);

  const updateDragPosition = useCallback((absoluteX, absoluteY) => {
    const deltaX = absoluteX - startFingerX.value;
    const deltaY = absoluteY - startFingerY.value;

    dragX.value = startCardX.value + deltaX;
    dragY.value = startCardY.value + deltaY;

    fingerX.value = absoluteX;
    fingerY.value = absoluteY;
  }, []);

  const getTargetColumn = useCallback(
    (absoluteX) => {
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
    (columnId, absoluteY, itemHeight = 60) => {
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
    (absoluteX, absoluteY) => {
      if (!draggedItem || !sourceColumnId) {
        setIsDragging(false);
        setDraggedItem(null);
        setSourceColumnId(null);
        return;
      }

      const targetColumnId = getTargetColumn(absoluteX);

      if (targetColumnId) {
        const dropIndex = getDropIndex(targetColumnId, absoluteY);

        if (targetColumnId === sourceColumnId) {
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
          onMoveCard(draggedItem.id, sourceColumnId, targetColumnId, dropIndex);
        }
      }

      setIsDragging(false);
      setDraggedItem(null);
      setSourceColumnId(null);
    },
    [draggedItem, sourceColumnId, columns, getTargetColumn, getDropIndex, onMoveCard, onReorderCards]
  );

  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    setDraggedItem(null);
    setSourceColumnId(null);
  }, []);

  const setOverlayOffset = useCallback((x, y) => {
    containerOffsetX.value = x || 0;
    containerOffsetY.value = y || 0;
  }, []);

  const value = {
    draggedItem,
    sourceColumnId,
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

export function useKanbanDrag() {
  const context = useContext(KanbanDragContext);
  if (!context) {
    throw new Error("useKanbanDrag must be used within a KanbanDragProvider");
  }
  return context;
}

export default KanbanDragContext;
