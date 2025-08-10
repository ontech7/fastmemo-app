import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import CategoryIcon from "../CategoryIcon";

function OrderedCategoryCard({ category, order, selected = false, toggleCategory = null }) {
  const { t } = useTranslation();

  const { index, name, icon } = category;

  const onPress = () => {
    toggleCategory && toggleCategory(category);
  };

  return (
    <View style={styles.buttonWrapper}>
      <TouchableOpacity style={[styles.button, selected && styles.selectedButton]} onPress={onPress}>
        <View style={styles.categoryWrapper}>
          {!index && <CategoryIcon name={icon} color={selected ? COLOR.darkBlue : COLOR.softWhite} />}

          <Text style={[styles.categoryName, selected && styles.selectedColor]}>{t(name)}</Text>
        </View>
      </TouchableOpacity>

      {order && (
        <View style={styles.categoryPosition_wrapper}>
          <Text style={styles.categoryPosition}>{order}</Text>
        </View>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  buttonWrapper: {
    position: "relative",
    width: SIZE.full,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    padding: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  selectedButton: {
    backgroundColor: COLOR.lightBlue,
  },
  selectedColor: {
    color: COLOR.darkBlue,
  },
  categoryPosition_wrapper: {
    position: "absolute",
    top: -5,
    left: -5,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.darkBlue,
    borderColor: COLOR.blue,
    borderWidth: 1,
    paddingHorizontal: PADDING_MARGIN.xs,
  },
  categoryPosition: {
    color: COLOR.softWhite,
    textAlign: "center",
    minWidth: 10,
  },
  categoryWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryName: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  numberOfNotesWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  textNumberOfNotes: {
    color: COLOR.softWhite,
    marginRight: PADDING_MARGIN.sm,
  },
  numberOfNotes_wrapper: {
    backgroundColor: COLOR.softWhite,
    borderRadius: BORDER.rounded,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs,
  },
  numberOfNotes: {
    color: COLOR.blue,
    fontWeight: FONTWEIGHT.semiBold,
    minWidth: 10,
    textAlign: "center",
  },
  selectedNumberOfNotes: {
    color: COLOR.softWhite,
    backgroundColor: COLOR.darkBlue,
  },
});

export default memo(OrderedCategoryCard);
