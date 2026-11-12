import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, KANBAN_COLUMN_COLORS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import ReorderOverlay from "@/components/reorder/ReorderOverlay";
import { edgeStep, FRAME_SLACK } from "@/libs/reorderDrop";
import { useReorder, useReorderDragged } from "@/providers/ReorderProvider";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { selectorDeveloperMode } from "@/slicers/settingsSlice";
import type { KanbanColumn as KanbanColumnType, KanbanItem, KanbanNote } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MouseEvent, ScrollViewInstance, TextInputInstance, ViewInstance } from "react-native";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useFrameCallback,
  useScrollViewOffset,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSelector } from "react-redux";
import uuid from "react-uuid";
import { KanbanCardStatic } from "./KanbanCard";

const isWeb = Platform.OS === "web";

/** Held this close to the board's left or right edge, a card scrolls it sideways. */
const EDGE = 48;
/** At most this many pixels per second, faster the closer to the edge (14 per frame at 60 Hz). */
const MAX_SPEED = 840;

/** The card in the air, as the drag's layer draws it: read-only, at its measured height. */
const renderLiftedCard = (item: KanbanItem, height: number | undefined) => <KanbanCardStatic item={item} height={height} />;

interface Props {
  note: KanbanNote;
  /** Applied to the note as it is when it runs: every handler here computes from it, so none depends on the note. */
  updateNoteAsync: (update: (current: KanbanNote) => KanbanNote) => void;
  columnWidth: number;
  snapInterval: number;
  /** Card id to autofocus on mount (only set for brand-new notes). */
  initialFocusCardId?: string | null;
}

export default function KanbanBoard({ note, updateNoteAsync, columnWidth, snapInterval, initialFocusCardId }: Props) {
  const { t } = useTranslation();

  const devMode = useSelector(selectorDeveloperMode);

  const maxColumns =
    devMode.enabled && devMode.unlimitedKanbanColumns ? Number.MAX_SAFE_INTEGER : configs.notes.maxKanbanColumns;

  const { active, returning, pointerX, layout, frameScrollX: boardScrollX, registerFrame } = useReorder();
  const dragged = useReorderDragged();
  const isDragging = dragged !== null;

  // The board's box: the drag's layer origin, measured by the engine at lift.
  const rootRef = useRef<ViewInstance>(null);
  useEffect(() => registerFrame(rootRef), [registerFrame]);

  const boardRef = useAnimatedRef<Animated.ScrollView>();
  useScrollViewOffset(boardRef, boardScrollX);
  const contentWidth = useSharedValue(0);
  const onContentSizeChange = useCallback((w: number) => contentWidth.set(w), [contentWidth]);

  // While a card is in the air (UI thread): the board scrolls sideways near its edges. The engine finds the target.
  const edgeScroll = useFrameCallback((frame) => {
    if (active.get() !== 1 || returning.get() === 1) return;
    const l = layout.get();
    if (!l) return;
    const x = pointerX.get();
    const now = boardScrollX.get();
    const { frame: board } = l;
    const left = x - board.x;
    const right = board.x + board.width - x;
    const max = Math.max(0, contentWidth.get() - board.width);
    let next = now;
    const ms = frame.timeSincePreviousFrame;
    if (left < EDGE && left > -FRAME_SLACK) next = Math.max(0, now - edgeStep(left, EDGE, MAX_SPEED, ms));
    else if (right < EDGE && right > -FRAME_SLACK) next = Math.min(max, now + edgeStep(right, EDGE, MAX_SPEED, ms));
    if (next !== now) scrollTo(boardRef, next, 0, false);
  }, false);
  const setEdgeScroll = edgeScroll.setActive;
  useAnimatedReaction(
    () => active.get(),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setEdgeScroll, now === 1);
    }
  );

  // Only the card whose id matches `focusCardId` autofocuses: the first card of a
  // new note (set at mount so its freshly-mounted input grabs focus), then
  // whichever card the user later adds via "Add card".
  const [focusCardId, setFocusCardId] = useState<string | null>(initialFocusCardId ?? null);

  // Mount-time autoFocus is frequently dropped while the screen transition is
  // still running, so re-focus the seeded first card imperatively once it
  // settles.
  const transitionDone = useScreenTransitionEnd();
  const cardInputRef = useRef<TextInputInstance>(null);
  const didFocusRef = useRef(false);

  useEffect(() => {
    if (didFocusRef.current) return;
    if (!initialFocusCardId || note.readOnly || !transitionDone) return;
    didFocusRef.current = true;
    cardInputRef.current?.focus();
  }, [transitionDone, initialFocusCardId, note.readOnly]);

  // Drag-to-scroll state for web/desktop
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  // Drag-to-scroll handlers for web/desktop
  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (!isWeb || isDragging) return;

      // Only start drag on left mouse button (RN's MouseEvent type omits `button`;
      // react-native-web forwards the DOM event, which has it)
      if ((event.nativeEvent as unknown as { button: number }).button !== 0) return;

      setIsDraggingScroll(true);
      dragStartX.current = event.nativeEvent.pageX;
      dragScrollLeft.current = boardScrollX.get();
    },
    [isDragging, boardScrollX]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isWeb || !isDraggingScroll || isDragging) return;

      event.preventDefault();
      const x = event.nativeEvent.pageX;
      const walk = dragStartX.current - x;
      const newOffset = dragScrollLeft.current + walk;

      (boardRef.current as unknown as ScrollViewInstance | null)?.scrollTo({ x: newOffset, animated: false });
    },
    [isDraggingScroll, isDragging, boardRef]
  );

  const handleMouseUp = useCallback(() => {
    if (!isWeb) return;
    setIsDraggingScroll(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isWeb) return;
    setIsDraggingScroll(false);
  }, []);

  /* Column operations: each computes from the note as it is when it runs (`current`), so a keystroke gives no column or
     card a new handler, and only what changed renders again. */

  const addColumn = useCallback(
    () =>
      updateNoteAsync((current) => {
        if (current.readOnly || current.columns.length >= maxColumns) return current;
        const colorIndex = current.columns.length % KANBAN_COLUMN_COLORS.length;
        return {
          ...current,
          columns: [...current.columns, { id: uuid(), name: "", color: KANBAN_COLUMN_COLORS[colorIndex], items: [] }],
        };
      }),
    [updateNoteAsync, maxColumns]
  );

  /** Changes one column, keeping the others' objects; nothing if it's gone or `change` returns it as it is. */
  const updateColumn = useCallback(
    (columnId: string, change: (column: KanbanColumnType) => KanbanColumnType) =>
      updateNoteAsync((current) => {
        const index = current.columns.findIndex((col) => col.id === columnId);
        if (index === -1) return current;
        const changed = change(current.columns[index]);
        if (changed === current.columns[index]) return current;
        const columns = [...current.columns];
        columns[index] = changed;
        return { ...current, columns };
      }),
    [updateNoteAsync]
  );

  const setColumnName = useCallback(
    (columnId: string, name: string) => updateColumn(columnId, (col) => (col.name === name ? col : { ...col, name })),
    [updateColumn]
  );

  const setColumnColor = useCallback(
    (columnId: string, color: string) => updateColumn(columnId, (col) => (col.color === color ? col : { ...col, color })),
    [updateColumn]
  );

  // A column with cards asks first; an empty one goes at once (one dialog for the board).
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  const removeColumn = useCallback(
    (columnId: string) =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const columns = current.columns.filter((col) => col.id !== columnId);
        return columns.length === current.columns.length ? current : { ...current, columns };
      }),
    [updateNoteAsync]
  );

  // The column says how many cards it holds: the board decides "at once or ask" without reading the note (LL-078).
  const deleteColumn = useCallback(
    (columnId: string, cardCount: number) => {
      if (cardCount === 0) removeColumn(columnId);
      else setColumnToDelete(columnId);
    },
    [removeColumn]
  );

  const pendingColumn = columnToDelete ? note.columns.find((col) => col.id === columnToDelete) : undefined;

  /* Card operations */

  const addCard = useCallback(
    (columnId: string) => {
      const newCard = { id: uuid(), text: "", createdAt: Date.now() };
      let added = false;
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const index = current.columns.findIndex((col) => col.id === columnId);
        if (index === -1) return current;
        added = true;
        const columns = [...current.columns];
        columns[index] = { ...columns[index], items: [...columns[index].items, newCard] };
        return { ...current, columns };
      });
      // Focus the freshly added card so the user can type without tapping it.
      if (added) setFocusCardId(newCard.id);
    },
    [updateNoteAsync]
  );

  const setCardText = useCallback(
    (columnId: string, cardId: string, text: string) =>
      updateColumn(columnId, (col) => {
        const index = col.items.findIndex((item) => item.id === cardId);
        if (index === -1 || col.items[index].text === text) return col;
        const items = [...col.items];
        items[index] = { ...items[index], text };
        return { ...col, items };
      }),
    [updateColumn]
  );

  const deleteCard = useCallback(
    (columnId: string, cardId: string) =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const index = current.columns.findIndex((col) => col.id === columnId);
        if (index === -1) return current;
        const items = current.columns[index].items.filter((item) => item.id !== cardId);
        if (items.length === current.columns[index].items.length) return current;
        const columns = [...current.columns];
        columns[index] = { ...columns[index], items };
        return { ...current, columns };
      }),
    [updateNoteAsync]
  );

  const moveColumn = useCallback(
    (columnId: string, direction: "left" | "right") =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const colIndex = current.columns.findIndex((col) => col.id === columnId);
        const targetIndex = direction === "left" ? colIndex - 1 : colIndex + 1;
        if (colIndex === -1 || targetIndex < 0 || targetIndex >= current.columns.length) return current;
        const columns = [...current.columns];
        const [moved] = columns.splice(colIndex, 1);
        columns.splice(targetIndex, 0, moved);
        return { ...current, columns };
      }),
    [updateNoteAsync]
  );

  return (
    <View style={styles.root} ref={rootRef}>
      {note.columns.length > 0 ? (
        <Animated.ScrollView
          ref={boardRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // A tap on a button or a card acts at once with the keyboard up (Add card while typing in a card); a tap on
          // empty space still closes it. The default spends the first tap on closing the keyboard.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.columnsScrollView}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEnabled={!isDragging}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          {...(isWeb && {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseLeave,
          })}
        >
          {note.columns.map((column, index) => (
            <KanbanColumn
              key={column.id}
              column={column}
              columnIndex={index}
              totalColumns={note.columns.length}
              columnWidth={columnWidth}
              setColumnName={setColumnName}
              setColumnColor={setColumnColor}
              deleteColumn={deleteColumn}
              setCardText={setCardText}
              deleteCard={deleteCard}
              addCard={addCard}
              moveColumn={moveColumn}
              disabled={note.readOnly}
              autoFocusCardId={focusCardId}
              autoFocusCardInputRef={cardInputRef}
            />
          ))}

          {!note.readOnly && note.columns.length < maxColumns && (
            <TouchableOpacity activeOpacity={0.7} style={styles.addColumnButton} onPress={addColumn}>
              <PlusIcon size={32} color={COLOR.textSecondary} />
              <Text style={styles.addColumnText}>{t("kanban.add_column")}</Text>
            </TouchableOpacity>
          )}
        </Animated.ScrollView>
      ) : (
        <View style={styles.emptyBoard}>
          <Text style={styles.emptyBoardText}>{t("kanban.no_columns")}</Text>
          {!note.readOnly && (
            <TouchableOpacity activeOpacity={0.7} style={styles.addFirstColumnButton} onPress={addColumn}>
              <PlusIcon size={24} color={COLOR.softWhite} />
              <Text style={styles.addFirstColumnText}>{t("kanban.add_column")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ReorderOverlay renderLifted={renderLiftedCard} />

      <ConfirmOrCancelDialog
        open={!!pendingColumn}
        description={
          pendingColumn
            ? t("kanban.delete_column_confirm", {
                name: pendingColumn.name.trim() || t("kanban.unnamed_column"),
                count: (pendingColumn.items ?? []).length,
              })
            : ""
        }
        onCancel={() => setColumnToDelete(null)}
        onConfirm={() => {
          if (columnToDelete) removeColumn(columnToDelete);
          setColumnToDelete(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  columnsScrollView: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.lg,
  },
  addColumnButton: {
    width: 170,
    height: SIZE.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: GLASS.border,
    borderStyle: "dashed",
    borderRadius: BORDER.normal,
  },
  addColumnText: {
    marginTop: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.small,
    fontFamily: FONT.medium,
    color: COLOR.textSecondary,
    textAlign: "center",
  },
  emptyBoard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.xl,
  },
  emptyBoardText: {
    color: COLOR.textMuted,
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
    backgroundColor: COLOR.accentMuted,
    borderRadius: BORDER.normal,
  },
  addFirstColumnText: {
    marginLeft: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
    color: COLOR.softWhite,
  },
});
