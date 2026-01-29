import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, XCircleIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import DragIcon from "../icons/DragIcon";

export default function TodoItem({ item, setText, checkItem, deleteItem, disabled, hidden, autoFocus }) {
  const [height, setHeight] = useState(40);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (hidden && item.checked) {
    return null;
  }

  return (
    <div ref={setNodeRef} style={style}>
      <View style={styles.todoItemContainer}>
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: disabled ? "default" : "grab",
            padding: 8,
            display: "flex",
            alignItems: "center",
          }}
        >
          <DragIcon
            iconProps={{
              color: COLOR.softWhite,
              opacity: 0.75,
            }}
          />
        </div>

        <TouchableOpacity activeOpacity={0.7} onPress={() => checkItem(item.id)} disabled={disabled} style={styles.checkbox}>
          {item.checked && <CheckIcon size={28} color={COLOR.softWhite} style={{ margin: 7 }} />}
        </TouchableOpacity>

        <TextInput
          style={[styles.listItemInput, { height }, item.checked && { textDecorationLine: "line-through", opacity: 0.5 }]}
          textAlignVertical="top"
          multiline
          scrollEnabled={false}
          value={item.text}
          onChangeText={(text) => setText(item.id, text)}
          editable={!disabled}
          placeholderTextColor={COLOR.placeholder}
          cursorColor={COLOR.softWhite}
          autoFocus={autoFocus && !item.text}
          onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
        />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => deleteItem(item.id)}
          disabled={disabled}
          style={styles.deleteButton}
        >
          <XCircleIcon size={24} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  todoItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
    gap: PADDING_MARGIN.sm,
  },
  listItemInput: {
    minHeight: 40,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 3,
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkbox: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 40,
    width: 40,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    padding: PADDING_MARGIN.sm,
  },
});
