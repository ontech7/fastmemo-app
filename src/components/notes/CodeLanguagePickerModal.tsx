import { CODE_LANGUAGES, LANGUAGE_LABELS } from "@/constants/code-languages";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, MONOSPACE_FONT, PADDING_MARGIN, SHADOW } from "@/constants/styles";
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
              <XMarkIcon size={22} color={COLOR.textSecondary} />
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
    ...SHADOW.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
  },
  modalTitle: {
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  modalList: {
    paddingVertical: PADDING_MARGIN.sm,
  },
  languageItem: {
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  languageItemSelected: {
    backgroundColor: COLOR.surfaceMuted,
  },
  languageItemText: {
    fontSize: FONTSIZE.paragraph,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.textSecondary,
  },
  languageItemTextSelected: {
    color: COLOR.accentSoft,
  },
});
