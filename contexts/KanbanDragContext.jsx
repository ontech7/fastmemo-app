import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

const KanbanDragContext = createContext(null);

export function KanbanDragProvider({ children, columns, onMoveCard, onReorderCards, scrollViewRef, columnWidth, columnGap }) {
  // Drag state
  const [draggedItem, setDraggedItem] = useState(null);
  const [sourceColumnId, setSourceColumnId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Animated position for the floating item (card's top-left corner)
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Offset of the overlay container relative to the window
  const containerOffsetX = useSharedValue(0);
  const containerOffsetY = useSharedValue(0);

  // Current finger position (absolute window coordinates)
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);

  // Initial finger position when drag started
  const startFingerX = useSharedValue(0);
  const startFingerY = useSharedValue(0);

  // Initial card position when drag started
  const startCardX = useSharedValue(0);
  const startCardY = useSharedValue(0);

  // Column positions for drop detection (stored as absolute positions at time of measurement)
  const columnPositionsRef = useRef([]);

  // Track scroll offset
  const scrollOffsetRef = useRef(0);

  const updateScrollOffset = useCallback((offset) => {
    scrollOffsetRef.current = offset;
  }, []);

  const registerColumnPosition = useCallback((columnId, x, width) => {
    // Store position relative to content (add current scroll offset to get content-relative position)
    const contentX = x + scrollOffsetRef.current;
    columnPositionsRef.current = columnPositionsRef.current.filter((c) => c.id !== columnId);
    columnPositionsRef.current.push({ id: columnId, x: contentX, width });
    columnPositionsRef.current.sort((a, b) => a.x - b.x);
  }, []);

  const startDrag = useCallback((item, columnId, absoluteX, absoluteY, cardX = 0, cardY = 0) => {
    setDraggedItem(item);
    setSourceColumnId(columnId);
    setIsDragging(true);
    // Store initial finger position
    startFingerX.value = absoluteX;
    startFingerY.value = absoluteY;
    // Set current finger position
    fingerX.value = absoluteX;
    fingerY.value = absoluteY;
    // Store initial card position
    startCardX.value = cardX;
    startCardY.value = cardY;
    // Set initial overlay position to card's position (no shift)
    dragX.value = cardX;
    dragY.value = cardY;
  }, []);

  const updateDragPosition = useCallback((absoluteX, absoluteY) => {
    // Calculate delta from starting finger position
    const deltaX = absoluteX - startFingerX.value;
    const deltaY = absoluteY - startFingerY.value;
    // Apply delta to starting card position
    dragX.value = startCardX.value + deltaX;
    dragY.value = startCardY.value + deltaY;
    // Update current finger position
    fingerX.value = absoluteX;
    fingerY.value = absoluteY;
  }, []);

  const getTargetColumn = useCallback(
    (absoluteX) => {
      // Convert screen X to content X by adding scroll offset
      const contentX = absoluteX + scrollOffsetRef.current;

      for (const col of columnPositionsRef.current) {
        if (contentX >= col.x && contentX <= col.x + col.width) {
          return col.id;
        }
      }

      // If beyond all columns, return the closest one
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

      return sourceColumnId; // Fall back to source column
    },
    [sourceColumnId]
  );

  const getDropIndex = useCallback(
    (columnId, absoluteY, itemHeight = 60) => {
      const column = columns.find((c) => c.id === columnId);
      if (!column) return 0;

      // Estimate position based on Y coordinate
      // Account for header, card count, and container padding
      const headerHeight = 120; // Approximate: header + card count + padding
      const cardSpacing = 8; // PADDING_MARGIN.sm
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
          // Reorder within same column
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
          // Move to different column
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

  // Register/update overlay container offset (in window coordinates)
  const setOverlayOffset = useCallback((x, y) => {
    containerOffsetX.value = x || 0;
    containerOffsetY.value = y || 0;
  }, []);

  const value = {
    // State
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

    // Methods
    startDrag,
    updateDragPosition,
    endDrag,
    cancelDrag,
    registerColumnPosition,
    getTargetColumn,
    updateScrollOffset,
    setOverlayOffset,

    // Config
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
