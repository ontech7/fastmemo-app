import KanbanColumn from "@/components/kanban/KanbanColumn";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, KANBAN_COLUMN_COLORS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useKanbanDrag } from "@/providers/KanbanDragProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PlusIcon } from "react-native-heroicons/outline";
import uuid from "react-uuid";
import KanbanDragOverlay from "./KanbanDragOverlay";

export default function KanbanBoard({ note, setNoteAsync, columnWidth, snapInterval, scrollViewRef }) {
  const { t } = useTranslation();

  const { isDragging, updateScrollOffset, setOverlayOffset, fingerX, containerOffsetX } = useKanbanDrag();
  const autoScrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const overlayRootRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleScroll = useCallback(
    (event) => {
      const offset = event.nativeEvent.contentOffset.x;
      scrollOffsetRef.current = offset;
      updateScrollOffset(offset);
    },
    [updateScrollOffset]
  );

  // measure overlay root to register offset relative to window
  const handleOverlayLayout = useCallback(
    (event) => {
      const { width } = event.nativeEvent.layout;
      setContainerWidth(width);

      if (!overlayRootRef.current) return;
      overlayRootRef.current.measureInWindow((x, y) => {
        setOverlayOffset(x, y);
      });
    },
    [setOverlayOffset]
  );

  // auto-scroll when dragging near edges
  useEffect(() => {
    if (!isDragging || containerWidth === 0) {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
        autoScrollRef.current = null;
      }
      return;
    }

    const EDGE_THRESHOLD = 50;
    const SCROLL_SPEED = 10;

    autoScrollRef.current = setInterval(() => {
      const x = fingerX.value - containerOffsetX.value;

      if (x < EDGE_THRESHOLD) {
        const newOffset = Math.max(0, scrollOffsetRef.current - SCROLL_SPEED);
        scrollOffsetRef.current = newOffset;
        updateScrollOffset(newOffset);
        scrollViewRef.current?.scrollTo({ x: newOffset, animated: false });
      } else if (x > containerWidth - EDGE_THRESHOLD) {
        const newOffset = scrollOffsetRef.current + SCROLL_SPEED;
        scrollOffsetRef.current = newOffset;
        updateScrollOffset(newOffset);
        scrollViewRef.current?.scrollTo({ x: newOffset, animated: false });
      }
    }, 16);

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };
  }, [isDragging, fingerX, containerOffsetX, containerWidth, scrollViewRef, updateScrollOffset]);

  /* Column operations */

  const addColumn = useCallback(() => {
    if (note.readOnly) return;
    if (note.columns.length >= 5) return;

    const colorIndex = note.columns.length % KANBAN_COLUMN_COLORS.length;
    setNoteAsync({
      ...note,
      columns: [
        ...note.columns,
        {
          id: uuid(),
          name: "",
          color: KANBAN_COLUMN_COLORS[colorIndex],
          items: [],
        },
      ],
    });
  }, [note, setNoteAsync]);

  const setColumnName = useCallback(
    (columnId, name) => {
      const columns = note.columns.map((col) => (col.id === columnId ? { ...col, name } : col));
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const setColumnColor = useCallback(
    (columnId, color) => {
      const columns = note.columns.map((col) => (col.id === columnId ? { ...col, color } : col));
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const deleteColumn = useCallback(
    (columnId) => {
      if (note.readOnly) return;

      const columns = note.columns.filter((col) => col.id !== columnId);
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  /* Card operations */

  const addCard = useCallback(
    (columnId) => {
      if (note.readOnly) return;

      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: [...col.items, { id: uuid(), text: "", createdAt: Date.now() }],
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const setCardText = useCallback(
    (columnId, cardId, text) => {
      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: col.items.map((item) => (item.id === cardId ? { ...item, text } : item)),
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const deleteCard = useCallback(
    (columnId, cardId) => {
      if (note.readOnly) return;

      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: col.items.filter((item) => item.id !== cardId),
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  return (
    <View style={{ flex: 1 }} ref={overlayRootRef} onLayout={handleOverlayLayout}>
      {note.columns.length > 0 ? (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columnsScrollView}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEnabled={!isDragging}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {note.columns.map((column, index) => (
            <KanbanColumn
              key={column.id}
              column={column}
              columnIndex={index}
              columnWidth={columnWidth}
              setColumnName={setColumnName}
              setColumnColor={setColumnColor}
              deleteColumn={deleteColumn}
              setCardText={setCardText}
              deleteCard={deleteCard}
              addCard={addCard}
              disabled={note.readOnly}
            />
          ))}

          {!note.readOnly && note.columns.length < 5 && (
            <TouchableOpacity activeOpacity={0.7} style={styles.addColumnButton} onPress={addColumn}>
              <PlusIcon size={32} color={COLOR.lightBlue} />
              <Text style={styles.addColumnText}>{t("kanban.add_column")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyBoard}>
          <Text style={styles.emptyBoardText}>{t("kanban.no_columns")}</Text>
          {!note.readOnly && (
            <TouchableOpacity activeOpacity={0.7} style={styles.addFirstColumnButton} onPress={addColumn}>
              <PlusIcon size={24} color={COLOR.darkBlue} />
              <Text style={styles.addFirstColumnText}>{t("kanban.add_column")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <KanbanDragOverlay columnWidth={columnWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  columnsScrollView: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.lg,
  },
  addColumnButton: {
    width: 170,
    height: SIZE.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    borderStyle: "dashed",
    borderRadius: BORDER.normal,
  },
  addColumnText: {
    marginTop: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.small,
    color: COLOR.lightBlue,
    textAlign: "center",
  },
  emptyBoard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.xl,
  },
  emptyBoardText: {
    color: COLOR.placeholder,
    fontSize: FONTSIZE.cardTitle,
    textAlign: "center",
    lineHeight: 25,
  },
  addFirstColumnButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.lightBlue,
    borderRadius: BORDER.normal,
  },
  addFirstColumnText: {
    marginLeft: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.darkBlue,
  },
});
