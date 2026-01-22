import React from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { XCircleIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import DragIcon from "../icons/DragIcon";

export default function KanbanCard({
  item,
  setText,
  deleteItem,
  onLongPress,
  drag,
  disabled,
  autoFocus,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.cardContent}>
        <TextInput
          style={styles.textInput}
          textAlignVertical="center"
          multiline
          onChangeText={(value) => setText(item.id, value)}
          value={item.text}
          editable={!disabled}
          cursorColor={COLOR.softWhite}
          autoFocus={autoFocus}
          placeholder=""
          placeholderTextColor={COLOR.placeholder}
        />

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.dragHandle}
          onPressIn={drag}
          onLongPress={onLongPress}
          delayLongPress={300}
        >
          <DragIcon
            iconProps={{
              color: COLOR.softWhite,
              opacity: 0.75,
            }}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        style={styles.deleteButton}
        onPress={() => deleteItem(item.id)}
      >
        <XCircleIcon size={24} color={COLOR.softWhite} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
  },
  textInput: {
    minHeight: 44,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 2,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderRightWidth: 0,
    borderColor: COLOR.boldBlue,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 2,
    borderRightColor: COLOR.boldBlue,
    borderTopWidth: 2,
    borderTopColor: COLOR.boldBlue,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.boldBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
  },
  deleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.xs,
  },
});
