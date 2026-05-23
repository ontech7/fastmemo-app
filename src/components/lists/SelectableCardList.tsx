import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircleIcon } from "react-native-heroicons/solid";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export interface SelectableCardItem<T extends string> {
  id: T;
  label: string;
  description?: string | null;
  extra?: React.ReactNode;
  disabled?: boolean;
  disabledLabel?: string;
}

interface Props<T extends string> {
  items: SelectableCardItem<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
}

export default function SelectableCardList<T extends string>({ items, selectedId, onSelect }: Props<T>) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const isSelected = item.id === selectedId;
        const isLast = index === items.length - 1;
        const disabled = item.disabled === true;
        const description = disabled && item.disabledLabel ? item.disabledLabel : item.description;

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.item,
              isLast && styles.itemLast,
              isSelected && !disabled && styles.itemSelected,
              disabled && styles.itemDisabled,
            ]}
            onPress={() => !disabled && onSelect(item.id)}
            activeOpacity={disabled ? 1 : 0.7}
            disabled={disabled}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.header}>
                <Text style={[styles.title, isSelected && !disabled && styles.titleSelected, disabled && styles.textDisabled]}>
                  {item.label}
                </Text>
                {item.extra}
              </View>
              {description ? <Text style={[styles.description, disabled && styles.textDisabled]}>{description}</Text> : null}
            </View>
            {isSelected && !disabled ? <CheckCircleIcon size={20} color={COLOR.oceanBreeze} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1.5,
    borderColor: COLOR.darkBlue,
    gap: PADDING_MARGIN.md,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemSelected: {
    backgroundColor: COLOR.blue,
  },
  itemDisabled: {
    opacity: 0.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  titleSelected: {
    color: COLOR.oceanBreeze,
    fontWeight: FONTWEIGHT.semiBold,
  },
  description: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    lineHeight: 16,
  },
  textDisabled: {
    color: COLOR.placeholder,
  },
});
