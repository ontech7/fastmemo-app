import React, { useCallback } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { PlusIcon, TrashIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import KanbanCard from "./KanbanCard";

const COLUMN_COLORS = [
  "#EEE78E", // yellow
  "#A7ABB9", // lightBlue
  "#B66465", // importantIcon (red)
  "#B9B5A7", // lightGray
  "#DAD9DE", // gray
];

export default function KanbanColumn({
  column,
  columns,
  setColumnName,
  setColumnColor,
  deleteColumn,
  setCardText,
  deleteCard,
  addCard,
  moveCard,
  reorderCards,
  disabled,
  autoFocus,
  t,
}) {
  const handleMoveCard = useCallback(
    (cardId) => {
      const otherColumns = columns.filter((col) => col.id !== column.id);
      if (otherColumns.length === 0) return;

      // Simple implementation: move to next column
      const currentIndex = columns.findIndex((col) => col.id === column.id);
      const nextIndex = (currentIndex + 1) % columns.length;
      const targetColumn = columns[nextIndex];

      if (targetColumn) {
        moveCard(cardId, column.id, targetColumn.id, targetColumn.items.length);
      }
    },
    [column, columns, moveCard]
  );

  const renderCard = useCallback(
    ({ item, drag, isActive }) => (
      <KanbanCard
        item={item}
        setText={(id, text) => setCardText(column.id, id, text)}
        deleteItem={(id) => deleteCard(column.id, id)}
        onLongPress={() => handleMoveCard(item.id)}
        drag={drag}
        disabled={isActive || disabled}
        autoFocus={autoFocus && !item.text}
      />
    ),
    [column.id, setCardText, deleteCard, handleMoveCard, disabled, autoFocus]
  );

  const cycleColor = useCallback(() => {
    const currentIndex = COLUMN_COLORS.indexOf(column.color);
    const nextIndex = (currentIndex + 1) % COLUMN_COLORS.length;
    setColumnColor(column.id, COLUMN_COLORS[nextIndex]);
  }, [column.id, column.color, setColumnColor]);

  return (
    <View style={styles.container}>
      {/* Column Header */}
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
          disabled={disabled}
          onPress={() => deleteColumn(column.id)}
          style={styles.deleteColumnButton}
        >
          <TrashIcon size={18} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      {/* Cards Count */}
      <Text style={styles.cardCount}>
        {column.items.length} {t ? t("kanban.cards_count") : "cards"}
      </Text>

      {/* Cards List */}
      <View style={styles.cardsContainer}>
        {column.items.length > 0 ? (
          <DraggableFlatList
            data={column.items}
            onDragEnd={({ data }) => reorderCards(column.id, data)}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            containerStyle={styles.cardsList}
          />
        ) : (
          <Text style={styles.noCards}>{t ? t("kanban.no_cards") : "No cards"}</Text>
        )}
      </View>

      {/* Add Card Button */}
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
    width: 300,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    overflow: "hidden",
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
  deleteColumnButton: {
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
