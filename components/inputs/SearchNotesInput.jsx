import React from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function SearchNotesInput({ text, onChangeText }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        style={styles.searchInput}
        cursorColor={COLOR.softWhite}
        placeholder={t("home.search")}
        placeholderTextColor={COLOR.placeholder}
      />

      {!text ? (
        <MagnifyingGlassIcon size={18} color={COLOR.softWhite} />
      ) : (
        <TouchableWithoutFeedback
          onPress={() => {
            onChangeText("");
            Keyboard.dismiss();
          }}
        >
          <XMarkIcon size={18} color={COLOR.softWhite} />
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
    marginBottom: PADDING_MARGIN.lg,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    color: COLOR.gray,
    paddingHorizontal: PADDING_MARGIN.sm,
  },
});
