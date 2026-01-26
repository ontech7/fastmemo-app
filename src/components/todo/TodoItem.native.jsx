import React from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, XCircleIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import DragIcon from "../icons/DragIcon";

export default function TodoItem({ item, setText, checkItem, deleteItem, drag, disabled, hidden, autoFocus }) {
  return (
    <>
      {(!item.checked || !hidden) && (
        <View
          style={{
            flexDirection: "row",
            marginBottom: PADDING_MARGIN.md,
          }}
        >
          <View
            style={{
              flex: 1,
              flexGrow: 1,
              flexDirection: "row",
              opacity: item.checked ? 0.5 : 1,
            }}
          >
            {/* checkbox */}

            <TouchableOpacity
              activeOpacity={0.7}
              disabled={disabled}
              style={{ marginRight: PADDING_MARGIN.sm }}
              onPress={() => checkItem(item.id)}
            >
              <View style={styles.checkbox}>
                {item.checked && <CheckIcon size={28} color={COLOR.softWhite} style={{ margin: 7 }} />}
              </View>
            </TouchableOpacity>

            {/* main text */}

            <TextInput
              style={[styles.listItemInput, item.checked && { textDecorationLine: "line-through", opacity: 0.5 }]}
              textAlignVertical="center"
              multiline
              onChangeText={(value) => setText(item.id, value)}
              value={item.text}
              editable={!disabled}
              cursorColor={COLOR.softWhite}
              autoFocus={autoFocus}
            />

            {/* drag and drop */}

            <TouchableOpacity activeOpacity={0.7} disabled={disabled} style={styles.drag} onPressIn={drag}>
              <DragIcon
                iconProps={{
                  color: COLOR.softWhite,
                  opacity: 0.75,
                }}
              />
            </TouchableOpacity>
          </View>

          {/* delete item */}

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            style={{ marginLeft: PADDING_MARGIN.sm }}
            onPress={() => deleteItem(item.id)}
          >
            <XCircleIcon size={28} color={COLOR.softWhite} style={{ marginVertical: 8 }} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  listItemInput: {
    minHeight: 48,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 4,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkbox: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  drag: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 2,
    borderRightColor: COLOR.boldBlue,
    borderTopWidth: 2,
    borderTopColor: COLOR.boldBlue,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.boldBlue,
    borderLeftWidth: 1,
    borderLeftColor: COLOR.darkBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
  },
});
