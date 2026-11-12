import { BORDER, COLOR, FONT, FONTSIZE, GLASS, KANBAN_COLUMN_COLORS, PADDING_MARGIN } from "@/constants/styles";
import { useKanbanDrag } from "@/providers/KanbanDragProvider";
import { memo, useCallback, useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
  type ViewInstance,
} from "react-native";
import ChevronLeftIcon from "react-native-heroicons/outline/ChevronLeftIcon";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import KanbanCard from "./KanbanCard";

import type { KanbanColumn as KanbanColumnType } from "@/types";

/** Held this close to the top or bottom of a column's card area, a card scrolls it. */
const EDGE = 40;
/** At most this many pixels per frame, faster the closer to the edge. */
const MAX_SPEED = 10;

interface Props {
  column: KanbanColumnType;
  columnIndex: number;
  totalColumns: number;
  columnWidth: number;
  setColumnName: (columnId: string, name: string) => void;
  setColumnColor: (columnId: string, color: string) => void;
  /** With the number of cards it holds: the board asks first if there are any. */
  deleteColumn: (columnId: string, cardCount: number) => void;
  setCardText: (columnId: string, cardId: string, text: string) => void;
  deleteCard: (columnId: string, cardId: string) => void;
  addCard: (columnId: string) => void;
  moveColumn: (columnId: string, direction: "left" | "right") => void;
  disabled: boolean;
  autoFocusCardId?: string | null;
  autoFocusCardInputRef?: RefObject<TextInputInstance | null>;
}

function KanbanColumn({
  column,
  columnIndex,
  totalColumns,
  columnWidth,
  setColumnName,
  setColumnColor,
  deleteColumn,
  setCardText,
  deleteCard,
  addCard,
  moveColumn,
  disabled,
  autoFocusCardId,
  autoFocusCardInputRef,
}: Props) {
  const { t } = useTranslation();

  const { active, target, layout, pointerY, columnScrollY, registerColumn } = useKanbanDrag();

  // The card area, measured by the provider at lift only.
  const areaRef = useRef<ViewInstance>(null);
  useEffect(() => registerColumn(column.id, { area: areaRef }), [registerColumn, column.id]);

  const listRef = useAnimatedRef<Animated.ScrollView>();
  const columnId = column.id;
  const scrollHandler = useAnimatedScrollHandler(
    (event) => {
      columnScrollY.modify((offsets) => {
        "worklet";
        offsets[columnId] = event.contentOffset.y;
        return offsets;
      });
    },
    [columnId]
  );
  const contentHeight = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const onContentSizeChange = useCallback((_: number, h: number) => contentHeight.set(h), [contentHeight]);
  const onListLayout = useCallback((e: LayoutChangeEvent) => viewHeight.set(e.nativeEvent.layout.height), [viewHeight]);

  /** The pointer's height inside the card area (clamped), or null when it is well outside it. */
  const pointerYIn = (top: number, height: number) => {
    "worklet";
    const y = pointerY.get() - top;
    return y < -EDGE || y > height + EDGE ? null : Math.min(Math.max(y, 0), height);
  };

  // While a card is held near this column's top or bottom edge, the column scrolls (UI thread).
  const autoScroll = useFrameCallback(() => {
    const t = target.get();
    const l = layout.get();
    if (active.get() !== 1 || !t || !l || l.columns[t.column]?.id !== columnId) return;
    const area = l.columns[t.column].area;
    const y = pointerYIn(area.y, area.height);
    if (y === null) return;
    const now = columnScrollY.get()[columnId] ?? 0;
    const max = Math.max(0, contentHeight.get() - viewHeight.get());
    let next = now;
    if (y < EDGE) next = Math.max(0, now - MAX_SPEED * (1 - y / EDGE));
    else if (y > area.height - EDGE) next = Math.min(max, now + MAX_SPEED * (1 - (area.height - y) / EDGE));
    if (next !== now) scrollTo(listRef, 0, next, false);
  }, false);
  const setAutoScroll = autoScroll.setActive;
  useAnimatedReaction(
    () => active.get(),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setAutoScroll, now === 1);
    }
  );

  // The column under the pointer has an accent edge (no re-render: only its color changes, so nothing moves).
  const borderStyle = useAnimatedStyle(() => {
    const t = target.get();
    const l = layout.get();
    const isTarget = active.get() === 1 && t !== null && l !== null && l.columns[t.column]?.id === columnId;
    return { borderColor: isTarget ? COLOR.accentSoft : GLASS.border };
  });

  const cycleColor = useCallback(() => {
    const currentIndex = KANBAN_COLUMN_COLORS.indexOf(column.color as (typeof KANBAN_COLUMN_COLORS)[number]);
    const nextIndex = (currentIndex + 1) % KANBAN_COLUMN_COLORS.length;
    setColumnColor(column.id, KANBAN_COLUMN_COLORS[nextIndex]);
  }, [column.id, column.color, setColumnColor]);

  return (
    <Animated.View style={[styles.container, { width: columnWidth }, borderStyle]}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={cycleColor}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.change_column_color")}
          style={[styles.colorIndicator, { backgroundColor: column.color }]}
        />

        <TextInput
          style={styles.columnName}
          value={column.name}
          onChangeText={(text) => setColumnName(column.id, text)}
          editable={!disabled}
          placeholder={t ? t("kanban.column_name_placeholder") : "Column name"}
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.softWhite}
          maxLength={24}
        />

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || columnIndex === 0}
          onPress={() => moveColumn(column.id, "left")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.move_column_left")}
          style={styles.headerButton}
        >
          <ChevronLeftIcon size={18} color={!disabled && columnIndex > 0 ? COLOR.textPrimary : COLOR.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || columnIndex === totalColumns - 1}
          onPress={() => moveColumn(column.id, "right")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.move_column_right")}
          style={[styles.headerButton, { marginRight: PADDING_MARGIN.md }]}
        >
          <ChevronRightIcon
            size={18}
            color={!disabled && columnIndex < totalColumns - 1 ? COLOR.textPrimary : COLOR.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => deleteColumn(column.id, column.items.length)}
          accessibilityRole="button"
          accessibilityLabel={t("kanban.delete_column")}
          style={styles.headerButton}
        >
          <TrashIcon size={18} color={COLOR.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cardCount}>
        {column.items.length} {t ? t("kanban.cards_count") : "cards"}
      </Text>

      <View style={styles.cardsContainer}>
        <View ref={areaRef} style={styles.cardsArea} onLayout={onListLayout}>
          <Animated.ScrollView
            ref={listRef}
            style={styles.cardsList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.cardsListContent}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
          >
            {column.items.length > 0 ? (
              column.items.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  columnId={column.id}
                  setText={setCardText}
                  deleteItem={deleteCard}
                  disabled={disabled}
                  autoFocus={item.id === autoFocusCardId}
                  inputRef={item.id === autoFocusCardId ? autoFocusCardInputRef : undefined}
                />
              ))
            ) : (
              <Text style={styles.noCards}>{t ? t("kanban.no_cards") : "No cards"}</Text>
            )}
          </Animated.ScrollView>
        </View>
      </View>

      {!disabled && (
        <TouchableOpacity activeOpacity={0.7} style={styles.addCardButton} onPress={() => addCard(column.id)}>
          <PlusIcon size={20} color={COLOR.softWhite} />
          <Text style={styles.addCardText}>{t ? t("kanban.add_card") : "Add card"}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: PADDING_MARGIN.md,
    backgroundColor: "transparent",
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: BORDER.small,
    marginRight: PADDING_MARGIN.sm,
  },
  columnName: {
    flex: 1,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    paddingVertical: 2,
  },
  headerButton: {
    padding: PADDING_MARGIN.xs,
    marginLeft: PADDING_MARGIN.xs,
  },
  cardCount: {
    fontSize: FONTSIZE.small,
    fontFamily: FONT.medium,
    color: COLOR.textMuted,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.xs,
    paddingBottom: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.sm,
    minHeight: 100,
  },
  cardsArea: {
    flex: 1,
  },
  cardsList: {
    flex: 1,
  },
  cardsListContent: {
    paddingBottom: PADDING_MARGIN.sm,
  },
  noCards: {
    textAlign: "center",
    color: COLOR.textMuted,
    fontSize: FONTSIZE.medium,
    paddingVertical: PADDING_MARGIN.lg,
  },
  addCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.accentMuted,
    paddingVertical: PADDING_MARGIN.sm,
    marginHorizontal: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  addCardText: {
    marginLeft: PADDING_MARGIN.xs,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
    color: COLOR.softWhite,
  },
});

export default memo(KanbanColumn);
