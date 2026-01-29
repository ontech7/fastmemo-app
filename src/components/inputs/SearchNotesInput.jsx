import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { DocumentMagnifyingGlassIcon, MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function SearchNotesInput({ text, onChangeText, showDeepSearch = false }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        cursorColor={COLOR.softWhite}
        placeholder={!showDeepSearch ? t("home.search") : t("home.deepSearch")}
        placeholderTextColor={COLOR.placeholder}
        style={styles.searchInput}
      />

      {!text ? (
        !showDeepSearch ? (
          <MagnifyingGlassIcon style={styles.icon} size={18} color={COLOR.softWhite} />
        ) : (
          <DocumentMagnifyingGlassIcon style={styles.icon} size={18} color={COLOR.softWhite} />
        )
      ) : (
        <TouchableWithoutFeedback
          style={styles.icon}
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
    paddingVertical: PADDING_MARGIN.sm,
  },
  icon: {
    marginRight: PADDING_MARGIN.xs,
  },
});
