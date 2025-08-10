import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { BORDER, COLOR, PADDING_MARGIN, SIZE } from "@/constants/styles";

import { getCategories } from "../slicers/categoriesSlice";
import GeneralSettingsButton from "./buttons/GeneralSettingsButton";
import ReorganizeButton from "./buttons/ReorganizeButton";
import TemporaryTrashButton from "./buttons/TemporaryTrashButton";
import FavoriteCategoryList from "./lists/FavoriteCategoryList";

export default function Sidebar() {
  const categories = useSelector(getCategories);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.sideBar}>
        <ReorganizeButton />
        <FavoriteCategoryList categories={categories} />
        <TemporaryTrashButton />
        <GeneralSettingsButton />
      </SafeAreaView>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLOR.blue,
    marginLeft: -PADDING_MARGIN.lg,
    marginRight: PADDING_MARGIN.lg,
  },
  sideBar: { paddingTop: PADDING_MARGIN.sm, height: SIZE.full },
  buttonsWrapper: {
    backgroundColor: COLOR.boldBlue,
    borderTopRightRadius: BORDER.normal,
    borderTopLeftRadius: BORDER.normal,
  },
});
