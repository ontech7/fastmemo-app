import React, { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import { BackHandler, FlatList, StyleSheet } from "react-native";

import CategoryFilterButton from "../buttons/CategoryFilterButton";

export default function FavoriteCategoryList({ categories }) {
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
  };

  // hardware back for resetting deleteMode
  useEffect(() => {
    const backAction = () => {
      if (isDeleteMode) {
        toggleDeleteMode();
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [isDeleteMode]);

  // vibration feedback when deleteMode
  useEffect(() => {
    if (!isDeleteMode) {
      return;
    }
    Haptics.selectionAsync();
  }, [isDeleteMode]);

  const renderItem = ({ item }) => (
    <CategoryFilterButton
      name={item.name}
      index={item.index}
      selected={item.selected}
      icon={item.icon}
      deleteMode={isDeleteMode}
      toggleDeleteMode={toggleDeleteMode}
    />
  );

  return (
    <FlatList
      style={styles.categoryList}
      showsVerticalScrollIndicator={false}
      data={categories}
      renderItem={renderItem}
      keyExtractor={(item) => `${item.name}_${item.icon}`}
    />
  );
}

const styles = StyleSheet.create({
  categoryList: { marginTop: 90, marginBottom: 70 },
});
