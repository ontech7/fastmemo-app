import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, KANBAN_COLUMN_COLORS, PADDING_MARGIN } from "@/constants/styles";
import { useKanbanDrag } from "@/providers/KanbanDragProvider";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "react-native-heroicons/outline";
import KanbanCard from "./KanbanCard";

import type { KanbanColumn as KanbanColumnType } from "@/types";

interface Props {
  column: KanbanColumnType;
  columnIndex: number;
  totalColumns: number;
  columnWidth: number;
  setColumnName: (columnId: string, name: string) => void;
  setColumnColor: (columnId: string, color: string) => void;
  deleteColumn: (columnId: string) => void;
  setCardText: (columnId: string, cardId: string, text: string) => void;
  deleteCard: (columnId: string, cardId: string) => void;
  addCard: (columnId: string) => void;
  moveColumn: (columnId: string, direction: "left" | "right") => void;
  disabled: boolean;
}

export default function KanbanColumn({
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
}: Props) {
  const { t } = useTranslation();

  const columnRef = useRef(null);
  const { registerColumnPosition, isDragging, targetColumnId, sourceColumnId } = useKanbanDrag();

  // register column position for drop detection
  useEffect(() => {
    if (columnRef.current) {
      columnRef.current.measureInWindow((x, y, width, height) => {
        registerColumnPosition(column.id, x, width);
      });
    }
  }, [column.id, columnWidth, registerColumnPosition]);

  const cycleColor = useCallback(() => {
    const currentIndex = KANBAN_COLUMN_COLORS.indexOf(column.color as (typeof KANBAN_COLUMN_COLORS)[number]);
    const nextIndex = (currentIndex + 1) % KANBAN_COLUMN_COLORS.length;
    setColumnColor(column.id, KANBAN_COLUMN_COLORS[nextIndex]);
  }, [column.id, column.color, setColumnColor]);

  const isDropTarget = isDragging && targetColumnId === column.id && sourceColumnId !== column.id;

  return (
    <View ref={columnRef} style={[styles.container, { width: columnWidth }, isDropTarget && styles.dropTarget]}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={cycleColor}
          style={[styles.colorIndicator, { backgroundColor: column.color }]}
        />

        <TextInput
          style={styles.columnName}
          value={column.name}
          onChangeText={(text) => setColumnName(column.id, text)}
          editable={!disabled}
          placeholder={t ? t("kanban.column_name_placeholder") : "Column name"}
          placeholderTextColor={COLOR.placeholder}
          cursorColor={COLOR.softWhite}
          maxLength={24}
        />

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || columnIndex === 0}
          onPress={() => moveColumn(column.id, "left")}
          style={styles.headerButton}
        >
          <ChevronLeftIcon size={18} color={!disabled && columnIndex > 0 ? COLOR.softWhite : COLOR.softenGray} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || columnIndex === totalColumns - 1}
          onPress={() => moveColumn(column.id, "right")}
          style={[styles.headerButton, { marginRight: PADDING_MARGIN.md }]}
        >
          <ChevronRightIcon
            size={18}
            color={!disabled && columnIndex < totalColumns - 1 ? COLOR.softWhite : COLOR.softenGray}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => deleteColumn(column.id)}
          style={styles.headerButton}
        >
          <TrashIcon size={18} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cardCount}>
        {column.items.length} {t ? t("kanban.cards_count") : "cards"}
      </Text>

      <View style={styles.cardsContainer}>
        {column.items.length > 0 ? (
          <ScrollView
            style={styles.cardsList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.cardsListContent}
          >
            {column.items.map((item, index) => (
              <KanbanCard
                key={item.id}
                item={item}
                columnId={column.id}
                setText={(id, text) => setCardText(column.id, id, text)}
                deleteItem={(id) => deleteCard(column.id, id)}
                disabled={disabled}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.noCards}>{t ? t("kanban.no_cards") : "No cards"}</Text>
        )}
      </View>

      {!disabled && (
        <TouchableOpacity activeOpacity={0.7} style={styles.addCardButton} onPress={() => addCard(column.id)}>
          <PlusIcon size={20} color={COLOR.darkBlue} />
          <Text style={styles.addCardText}>{t ? t("kanban.add_card") : "Add card"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    overflow: "hidden",
  },
  dropTarget: {
    borderColor: COLOR.lightBlue,
    borderWidth: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
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
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    paddingVertical: 2,
  },
  headerButton: {
    padding: PADDING_MARGIN.xs,
    marginLeft: PADDING_MARGIN.xs,
  },
  cardCount: {
    fontSize: FONTSIZE.small,
    color: COLOR.lightBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.xs,
    paddingBottom: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.sm,
    minHeight: 100,
  },
  cardsList: {
    flex: 1,
  },
  cardsListContent: {
    paddingBottom: PADDING_MARGIN.sm,
  },
  noCards: {
    textAlign: "center",
    color: COLOR.placeholder,
    fontSize: FONTSIZE.medium,
    paddingVertical: PADDING_MARGIN.lg,
  },
  addCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.lightBlue,
    paddingVertical: PADDING_MARGIN.sm,
    marginHorizontal: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  addCardText: {
    marginLeft: PADDING_MARGIN.xs,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.darkBlue,
  },
});
