import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, StyleSheet, TextInput } from "react-native";
import { DocumentMagnifyingGlassIcon, MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONT, PADDING_MARGIN } from "@/constants/styles";
import GlassSurface from "@/components/ui/GlassSurface";

interface Props {
  text: string;
  onChangeText: (text: string) => void;
  showDeepSearch?: boolean;
}

export default function SearchNotesInput({ text, onChangeText, showDeepSearch = false }: Props) {
  const { t } = useTranslation();

  return (
    <GlassSurface radius={BORDER.big} style={styles.container}>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        cursorColor={COLOR.softWhite}
        placeholder={!showDeepSearch ? t("home.search") : t("home.deepSearch")}
        placeholderTextColor={COLOR.placeholder}
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      {!text ? (
        !showDeepSearch ? (
          <MagnifyingGlassIcon style={styles.icon} size={18} color={COLOR.softWhite} />
        ) : (
          <DocumentMagnifyingGlassIcon style={styles.icon} size={18} color={COLOR.softWhite} />
        )
      ) : (
        <Pressable
          style={styles.icon}
          hitSlop={8}
          onPress={() => {
            onChangeText("");
            Keyboard.dismiss();
          }}
        >
          <XMarkIcon size={18} color={COLOR.softWhite} />
        </Pressable>
      )}
    </GlassSurface>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
    marginBottom: PADDING_MARGIN.lg,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    color: COLOR.gray,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
  },
  icon: {
    marginRight: PADDING_MARGIN.xs,
  },
});
