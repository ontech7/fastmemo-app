import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity } from "react-native";
import { FolderPlusIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function AddCategoryButton() {
  const router = useRouter();

  return (
    <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/categories/create")}>
      <FolderPlusIcon size={28} color={COLOR.darkBlue} />
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    position: "absolute",
    bottom: 40,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
