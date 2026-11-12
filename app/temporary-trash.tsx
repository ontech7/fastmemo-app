import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import type { Note } from "@/types";
import Haptics from "@/libs/haptics";
import { webhook } from "@/utils/webhook";
import SafeAreaView from "@/components/SafeAreaView";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

import BackButton from "@/components/buttons/BackButton";
import TrashedNotesSettingsButton from "@/components/buttons/TrashedNotesSettingsButton";
import TrashedNoteCard from "@/components/cards/TrashedNoteCard";
import SearchInput from "@/components/inputs/SearchInput";
import AppBackground from "@/components/ui/AppBackground";
import EmptyState from "@/components/ui/EmptyState";
import { deleteNote, getTemporaryTrashTimespan, getTrashedNotesFilteredPerCategory } from "@/slicers/notesSlice";
import {
  selectorDeveloperMode,
  selectorIsFingerprintEnabled,
  selectorShowHidden,
  selectorWebhook_deleteNote,
} from "@/slicers/settingsSlice";

export default function TemporaryTrashScreen() {
  const { t } = useTranslation();

  const [filterText, setFilterText] = useState("");
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);

  const showHidden = useSelector(selectorShowHidden);
  const selectTrashedNotes = useMemo(() => getTrashedNotesFilteredPerCategory(showHidden), [showHidden]);
  const trashedNotes = useSelector(selectTrashedNotes);

  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);
  const devMode = useSelector(selectorDeveloperMode);
  const trashDays = useSelector(getTemporaryTrashTimespan);

  const dispatch = useDispatch();

  const toggleDeleteMode = useCallback(() => {
    if (isDeleteMode) {
      setSelectedNotes([]);
    }

    setIsDeleteMode((p: boolean) => !p);
  }, [isDeleteMode]);

  const selectNote = useCallback((currId: string, currLocked: boolean) => {
    const idAndLocked = `${currId}|${currLocked}`;

    setSelectedNotes((prevIds: string[]) => {
      if (prevIds.includes(idAndLocked)) {
        return prevIds.filter((prevId: string) => !prevId.includes(idAndLocked));
      } else {
        return [...prevIds, idAndLocked];
      }
    });
  }, []);

  const filteredNotes = useMemo(() => {
    if (!filterText.trim()) {
      return trashedNotes;
    }

    return trashedNotes.filter((note: Note) => note.title?.toLowerCase().includes(filterText.toLowerCase()));
  }, [filterText, trashedNotes]);

  // An empty trash says how long notes stay; a search with no match says so (spec 5.3).
  const unlimitedTrash = devMode.enabled && devMode.unlimitedTrashTime;
  const searching = filterText.trim() !== "";
  const emptyState = useMemo(
    () =>
      searching ? (
        <EmptyState variant="search" />
      ) : (
        <EmptyState variant="trash" days={unlimitedTrash ? undefined : trashDays} />
      ),
    [searching, unlimitedTrash, trashDays]
  );
  const listContentStyle = filteredNotes.length === 0 ? styles.listContentEmpty : undefined;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeleteMode]);

  // vibration feedback when deleteMode
  useEffect(() => {
    if (!isDeleteMode) {
      return;
    }
    Haptics.selectionAsync();
  }, [isDeleteMode]);

  // delete note if the time has passed
  useEffect(() => {
    const isUnlimitedTrash = devMode.enabled && devMode.unlimitedTrashTime;
    if (isUnlimitedTrash) return;

    trashedNotes.forEach((note: Note) => {
      const currentDate = new Date().getTime();

      if (currentDate > note.deleteDate) {
        dispatch(deleteNote(note.id));
        webhook(webhook_deleteNote, {
          action: "note/deleteNote",
          id: note.id,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset states
  const navigation = useNavigation();

  useEffect(() => {
    const handleFocus = () => {
      setSelectedNotes([]);
      setIsDeleteMode(false);
      setFilterText("");
    };

    const unsubscribe = navigation.addListener("focus", handleFocus);

    return () => unsubscribe();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip shortcut={!isDeleteMode} />

        <Text style={styles.headerTitle}>{t("trashednotes.title")}</Text>

        <TrashedNotesSettingsButton
          selectedNotes={selectedNotes}
          setSelectedNotes={setSelectedNotes}
          isDeleteMode={isDeleteMode}
          setIsDeleteMode={setIsDeleteMode}
          isFingerprintEnabled={selectorFingerprintEnabled}
        />
      </View>

      <SearchInput value={filterText} onChangeText={setFilterText} placeholder={t("home.search")} />

      <FlashList
        maintainVisibleContentPosition={{
          disabled: true,
        }}
        showsVerticalScrollIndicator={false}
        data={filteredNotes}
        extraData={{ isDeleteMode }}
        renderItem={({ item }) => (
          <TrashedNoteCard
            content={item}
            isSelected={selectedNotes.includes(`${item.id}|${item.locked}`)}
            selectNote={selectNote}
            isDeleteMode={isDeleteMode}
            toggleDeleteMode={toggleDeleteMode}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={listContentStyle}
        ListEmptyComponent={emptyState}
      />
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  // An empty list's content fills the list, so its empty state sits in the middle.
  listContentEmpty: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
});
