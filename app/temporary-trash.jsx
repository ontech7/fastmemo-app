import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { webhook } from "@/utils/webhook";
import SafeAreaView from "@/components/SafeAreaView";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import BackButton from "../components/buttons/BackButton";
import TrashedNotesSettingsButton from "../components/buttons/TrashedNotesSettingsButton";
import TrashedNoteCard from "../components/cards/TrashedNoteCard";
import SearchNotesInput from "../components/inputs/SearchNotesInput";
import { deleteNote, getTrashedNotesFilteredPerCategory } from "../slicers/notesSlice";
import { selectorIsFingerprintEnabled, selectorShowHidden, selectorWebhook_deleteNote } from "../slicers/settingsSlice";

export default function TemporaryTrashScreen() {
  const { t } = useTranslation();

  const [filterText, setFilterText] = useState("");
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState([]);

  const showHidden = useSelector(selectorShowHidden);
  const trashedNotes = useSelector(getTrashedNotesFilteredPerCategory(showHidden));

  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const dispatch = useDispatch();

  const toggleDeleteMode = useCallback(() => {
    if (isDeleteMode) {
      setSelectedNotes([]);
    }

    setIsDeleteMode((p) => !p);
  }, [isDeleteMode]);

  const selectNote = useCallback((currId, currLocked) => {
    const idAndLocked = `${currId}|${currLocked}`;

    setSelectedNotes((prevIds) => {
      if (prevIds.includes(idAndLocked)) {
        return prevIds.filter((prevId) => !prevId.includes(idAndLocked));
      } else {
        return [...prevIds, idAndLocked];
      }
    });
  }, []);

  const filteredNotes = useMemo(() => {
    if (!filterText.trim()) {
      return trashedNotes;
    }

    return trashedNotes.filter((note) => note.title?.toLowerCase().includes(filterText.toLowerCase()));
  }, [filterText, trashedNotes]);

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

  // delete note if the time has passed
  useEffect(() => {
    trashedNotes.forEach((note) => {
      const currentDate = new Date().getTime();

      if (currentDate > note.deleteDate) {
        dispatch(deleteNote(note.id));
        webhook(webhook_deleteNote, {
          action: "note/deleteNote",
          id: note.id,
        });
      }
    });
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
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("trashednotes.title")}</Text>

        <TrashedNotesSettingsButton
          selectedNotes={selectedNotes}
          setSelectedNotes={setSelectedNotes}
          isDeleteMode={isDeleteMode}
          setIsDeleteMode={setIsDeleteMode}
          isFingerprintEnabled={selectorFingerprintEnabled}
        />
      </View>

      <SearchNotesInput text={filterText} onChangeText={setFilterText} />

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
      />
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  deleteModeContainer: { flexDirection: "row" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  categoryName: {
    color: COLOR.lightBlue,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
