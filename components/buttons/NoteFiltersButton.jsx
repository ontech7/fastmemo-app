import React from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon, DocumentMagnifyingGlassIcon, FunnelIcon } from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useSelector } from "react-redux";

import { toggleWithSecret } from "@/utils/crypt";
import ContextMenu from "@/components/renderers/ContextMenu";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function NoteFiltersButton({ filters }) {
  const { t } = useTranslation();

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const router = useRouter();

  return (
    <Menu renderer={ContextMenu}>
      <MenuTrigger customStyles={{ TriggerTouchableComponent: TouchableOpacity }}>
        <FunnelIcon size={28} color={COLOR.softWhite} />
      </MenuTrigger>

      <MenuOptions customStyles={menuOptionsCustomStyles}>
        <MenuOption
          style={styles.menuOption}
          onSelect={() => {
            if (!filters.showDeepSearch) {
              toggleWithSecret({
                router,
                isFingerprintEnabled: selectorFingerprintEnabled,
                callback: filters.toggleDeepSearch,
              });
            } else {
              filters.toggleDeepSearch();
            }
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {filters.showDeepSearch && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, filters.showDeepSearch && styles.menuOptionTextSelected]}>
              {t("home.filters.deepSearch")}
            </Text>
          </View>

          <DocumentMagnifyingGlassIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>
      </MenuOptions>
    </Menu>
  );
}

/* STYLES */

const menuOptionsCustomStyles = {
  optionsContainer: {
    marginTop: PADDING_MARGIN.xl,
    marginRight: 5,
    backgroundColor: COLOR.blue,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    width: 220,
  },
  optionsWrapper: {
    backgroundColor: COLOR.blue,
  },
};

const styles = StyleSheet.create({
  menuViewWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOption: {
    padding: PADDING_MARGIN.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOptionDisabled: {
    opacity: 0.5,
  },
  menuOptionIcon: {
    marginLeft: PADDING_MARGIN.lg,
  },
  menuOptionText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
  },
  menuOptionTextSelected: {
    fontWeight: FONTWEIGHT.semiBold,
  },
});
