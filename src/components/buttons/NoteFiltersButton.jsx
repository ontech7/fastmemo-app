import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  CheckIcon,
  DocumentMagnifyingGlassIcon,
  FunnelIcon,
} from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useDispatch, useSelector } from "react-redux";

import { toggleWithSecret } from "@/utils/crypt";
import { useRouter } from "@/hooks/useRouter";
import ContextMenu from "@/components/renderers/ContextMenu";
import { getNoteFilters, reorderNotes, setNoteFilters } from "@/slicers/notesSlice";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function NoteFiltersButton({ filters }) {
  const { t } = useTranslation();

  const router = useRouter();

  const dispatch = useDispatch();

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const selectorNotesOrder = useSelector(getNoteFilters);

  const changeNotesOrder = (sortBy) => {
    let order = selectorNotesOrder.order === "asc" ? "desc" : "asc";

    if (sortBy !== selectorNotesOrder.sortBy) {
      order = "desc";
    }

    dispatch(setNoteFilters({ sortBy, order }));
  };

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {filters.showDeepSearch && <CheckIcon size={16} color={COLOR.softWhite} />}

            <Text style={[styles.menuOptionText, filters.showDeepSearch && styles.menuOptionTextSelected]}>
              {t("home.filters.deepSearch")}
            </Text>
          </View>

          <DocumentMagnifyingGlassIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <View style={styles.divider} />

        <Text style={styles.menuLabel}>{t("home.filters.orderBy")}</Text>

        <MenuOption
          style={styles.menuOption}
          onSelect={() => {
            changeNotesOrder("createdAt");
            dispatch(reorderNotes());
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {selectorNotesOrder.sortBy === "createdAt" && selectorNotesOrder.order === "asc" ? (
              <ArrowLongUpIcon size={16} color={COLOR.softWhite} />
            ) : selectorNotesOrder.sortBy === "createdAt" && selectorNotesOrder.order === "desc" ? (
              <ArrowLongDownIcon size={16} color={COLOR.softWhite} />
            ) : null}

            <Text style={[styles.menuOptionText, filters.showDeepSearch && styles.menuOptionTextSelected]}>
              {t("home.filters.createdAt")}
            </Text>
          </View>
        </MenuOption>

        <MenuOption
          style={styles.menuOption}
          onSelect={() => {
            changeNotesOrder("updatedAt");
            dispatch(reorderNotes());
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {selectorNotesOrder.sortBy === "updatedAt" && selectorNotesOrder.order === "asc" ? (
              <ArrowLongUpIcon size={16} color={COLOR.softWhite} />
            ) : selectorNotesOrder.sortBy === "updatedAt" && selectorNotesOrder.order === "desc" ? (
              <ArrowLongDownIcon size={16} color={COLOR.softWhite} />
            ) : null}

            <Text style={[styles.menuOptionText, filters.showDeepSearch && styles.menuOptionTextSelected]}>
              {t("home.filters.updatedAt")}
            </Text>
          </View>
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
  menuLabel: {
    paddingHorizontal: PADDING_MARGIN.sm,
    color: COLOR.placeholder,
    marginBottom: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.sm,
  },
  divider: {
    height: 1.5,
    backgroundColor: COLOR.boldBlue,
    width: "108%",
    marginVertical: PADDING_MARGIN.sm,
    marginLeft: -8,
  },
});
