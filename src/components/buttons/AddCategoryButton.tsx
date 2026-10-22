import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity } from "react-native";
import FolderPlusIcon from "react-native-heroicons/outline/FolderPlusIcon";

import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, PADDING_MARGIN, SHADOW } from "@/constants/styles";

export default function AddCategoryButton() {
  const { t } = useTranslation();

  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.addBtn}
      onPress={() => router.push("/categories/create")}
      accessibilityRole="button"
      accessibilityLabel={t("createcategory.title_create")}
    >
      <FolderPlusIcon size={28} color={COLOR.softWhite} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    position: "absolute",
    bottom: 60,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
});
