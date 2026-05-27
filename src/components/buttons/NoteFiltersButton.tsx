import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  CheckIcon,
  DocumentMagnifyingGlassIcon,
  FunnelIcon,
} from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import GlassSurface from "@/components/ui/GlassSurface";
import PopupMenu, { PopupMenuDivider, PopupMenuLabel, PopupMenuOption } from "@/components/ui/PopupMenu";
import { getNoteFilters, reorderNotes, setNoteFilters } from "@/slicers/notesSlice";

import { BORDER, COLOR } from "@/constants/styles";
import { useSecret } from "@/hooks/useSecret";

interface Props {
  filters: {
    showDeepSearch: boolean;
    toggleDeepSearch: () => void;
  };
}

export default function NoteFiltersButton({ filters }: Props) {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const { unlockWithSecret } = useSecret();

  const selectorNotesOrder = useSelector(getNoteFilters);

  const changeNotesOrder = (sortBy: "createdAt" | "updatedAt") => {
    let order: "asc" | "desc" = selectorNotesOrder.order === "asc" ? "desc" : "asc";

    if (sortBy !== selectorNotesOrder.sortBy) {
      order = "desc";
    }

    dispatch(setNoteFilters({ sortBy, order }));
  };

  const sortArrow = (sortBy: "createdAt" | "updatedAt") => {
    if (selectorNotesOrder.sortBy !== sortBy) {
      return undefined;
    }
    return selectorNotesOrder.order === "asc" ? (
      <ArrowLongUpIcon size={16} color={COLOR.accentSoft} />
    ) : (
      <ArrowLongDownIcon size={16} color={COLOR.accentSoft} />
    );
  };

  return (
    <PopupMenu
      trigger={
        <GlassSurface radius={BORDER.big} style={styles.trigger}>
          <FunnelIcon size={20} color={COLOR.softWhite} />
        </GlassSurface>
      }
    >
      <PopupMenuOption
        label={t("home.filters.deepSearch")}
        selected={filters.showDeepSearch}
        leading={filters.showDeepSearch ? <CheckIcon size={16} color={COLOR.accentSoft} /> : undefined}
        trailing={<DocumentMagnifyingGlassIcon size={16} color={COLOR.textSecondary} />}
        onSelect={() => {
          if (!filters.showDeepSearch) {
            unlockWithSecret(filters.toggleDeepSearch);
          } else {
            filters.toggleDeepSearch();
          }
        }}
      />

      <PopupMenuDivider />

      <PopupMenuLabel>{t("home.filters.orderBy")}</PopupMenuLabel>

      <PopupMenuOption
        label={t("home.filters.createdAt")}
        selected={selectorNotesOrder.sortBy === "createdAt"}
        leading={sortArrow("createdAt")}
        onSelect={() => {
          changeNotesOrder("createdAt");
          dispatch(reorderNotes());
        }}
      />

      <PopupMenuOption
        label={t("home.filters.updatedAt")}
        selected={selectorNotesOrder.sortBy === "updatedAt"}
        leading={sortArrow("updatedAt")}
        onSelect={() => {
          changeNotesOrder("updatedAt");
          dispatch(reorderNotes());
        }}
      />
    </PopupMenu>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  trigger: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
});
