import { CODE_LANGUAGES, LANGUAGE_LABELS } from "@/constants/code-languages";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, MONOSPACE_FONT, PADDING_MARGIN } from "@/constants/styles";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { XMarkIcon } from "react-native-heroicons/outline";

interface Props {
  visible: boolean;
  selectedLanguage: string;
  onSelect: (language: string) => void;
  onClose: () => void;
  title: string;
}

export default function CodeLanguagePickerModal({ visible, selectedLanguage, onSelect, onClose, title }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <XMarkIcon size={22} color={COLOR.softWhite} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList} showsVerticalScrollIndicator>
            {CODE_LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.languageItem, isSelected && styles.languageItemSelected]}
                  onPress={() => onSelect(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.languageItemText, isSelected && styles.languageItemTextSelected]}>
                    {LANGUAGE_LABELS[lang]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.blue,
  },
  modalTitle: {
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  modalList: {
    paddingVertical: PADDING_MARGIN.sm,
  },
  languageItem: {
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  languageItemSelected: {
    backgroundColor: COLOR.blue,
  },
  languageItemText: {
    fontSize: FONTSIZE.paragraph,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
  },
  languageItemTextSelected: {
    color: COLOR.codeMint,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
