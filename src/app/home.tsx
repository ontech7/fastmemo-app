import AddNoteOverlayButton from "@/components/buttons/AddNoteOverlayButton";
import DeleteNotesButton from "@/components/buttons/DeleteNotesButton";
import FavoriteNotesButton from "@/components/buttons/FavoriteNotesButton";
import HiddenNotesButton from "@/components/buttons/HiddenNotesButton";
import NoteFiltersButton from "@/components/buttons/NoteFiltersButton";
import ProtectNotesButton from "@/components/buttons/ProtectNotesButton";
import ReadOnlyNotesButton from "@/components/buttons/ReadOnlyNotesButton";
import NoteCard from "@/components/cards/NoteCard";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SearchInput from "@/components/inputs/SearchInput";
import SafeAreaView from "@/components/SafeAreaView";
import Sidebar from "@/components/Sidebar";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, FONTWEIGHT, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import Haptics from "@/libs/haptics";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import {
  deleteNote,
  getNotesFilteredPerCategory,
  temporaryDeleteSelectedNotes,
  toggleHiddenNotes,
  toggleImportantNotes,
  toggleProtectedNotes,
  toggleReadOnlyNotes,
} from "@/slicers/notesSlice";
import {
  selectorDeveloperMode,
  selectorShowHidden,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import type { CodeNote, Note, TextNote, TodoItem, TodoNote } from "@/types";
import { formatToPlainText } from "@/utils/string";
import { webhook } from "@/utils/webhook";
import VaultPromptDialog from "@/components/dialogs/VaultPromptDialog";
import { useVaultPrompt } from "@/hooks/useVaultPrompt";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { setVaultPromptNeeded } from "@/libs/vaultPrompt";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, StyleSheet, Text, View } from "react-native";
import { DocumentMagnifyingGlassIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useDispatch, useSelector, useStore } from "react-redux";

export default function HomeScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const isFocused = useIsFocused();
  const vaultPromptNeeded = useVaultPrompt();
  const vaultUnlocked = useVaultUnlocked();
  // Gate the vault prompt until the version/changelog check has settled, so it
  // never overlaps the changelog screen that opens on a version bump.
  const [changelogChecked, setChangelogChecked] = useState(false);

  const store = useStore();

  const currentCategory = useSelector(getCurrentCategory);
  const showHidden = useSelector(selectorShowHidden);
  // Keep the memoized selector instance stable across renders — building it inline
  // on every render gives reselect an empty cache each time, so `notes` would be a
  // fresh array on every render and rebuild the whole list (jank while typing).
  const selectNotes = useMemo(() => getNotesFilteredPerCategory(currentCategory, showHidden), [currentCategory, showHidden]);
  const notes = useSelector(selectNotes);

  // @ts-ignore
  const trashedNotes = store.getState().notes.temporaryItems;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const devMode = useSelector(selectorDeveloperMode);

  const dispatch = useDispatch();

  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const [showDeepSearch, setShowDeepSearch] = useState(false);
  const [deepFilterText, setDeepFilterText] = useState("");
  const [filterText, setFilterText] = useState("");

  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const isNoteProtected = selectedNotes.some((id: string) => id.split("|")[1] == "true");

  const [showDeleteNotesDialog, setShowDeleteNotesDialog] = useState(false);

  const { unlockWithSecret } = useSecret();

  const temporaryDeleteSelectedNotesFromItems = () => {
    const deleteNotes = () => {
      dispatch(temporaryDeleteSelectedNotes(selectedNotes));
      webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        extra: "multiple",
        ids: selectedNotes.map((noteId: string) => noteId.split("|")[0]),
      });
      setSelectedNotes([]);
      setIsDeleteMode(false);
    };

    if (isNoteProtected) {
      unlockWithSecret(deleteNotes);
    } else {
      deleteNotes();
    }
  };

  const toggleImportantNotesFromItems = () => {
    dispatch(toggleImportantNotes(selectedNotes));
    webhook(webhook_updateNote, {
      action: "note/updateNote",
      extra: "multiple",
      ids: selectedNotes.map((noteId: string) => noteId.split("|")[0]),
      property: "important",
    });
    setSelectedNotes([]);
    setIsDeleteMode(false);
  };

  const toggleReadOnlyNotesFromItems = () => {
    dispatch(toggleReadOnlyNotes(selectedNotes));
    webhook(webhook_updateNote, {
      action: "note/updateNote",
      extra: "multiple",
      ids: selectedNotes.map((noteId: string) => noteId.split("|")[0]),
      property: "readOnly",
    });
    setSelectedNotes([]);
    setIsDeleteMode(false);
  };

  const toggleHiddenNotesFromItems = () => {
    dispatch(toggleHiddenNotes(selectedNotes));
    webhook(webhook_updateNote, {
      action: "note/updateNote",
      extra: "multiple",
      ids: selectedNotes.map((noteId: string) => noteId.split("|")[0]),
      property: "hidden",
    });
    setSelectedNotes([]);
    setIsDeleteMode(false);
  };

  const toggleProtectedNotesFromItems = () => {
    unlockWithSecret(() => {
      dispatch(toggleProtectedNotes(selectedNotes));
      webhook(webhook_updateNote, {
        action: "note/updateNote",
        extra: "multiple",
        ids: selectedNotes.map((noteId: string) => noteId.split("|")[0]),
        property: "locked",
      });
      setSelectedNotes([]);
      setIsDeleteMode(false);
    });
  };

  const toggleDeleteMode = useCallback(() => {
    if (isDeleteMode) setSelectedNotes([]);
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
    const text = !showDeepSearch ? filterText.trim().toLowerCase() : deepFilterText.trim().toLowerCase();

    if (!showDeepSearch) {
      return !text ? notes : notes.filter((note: Note) => note.title?.toLowerCase().includes(filterText.toLowerCase()));
    } else {
      return !text
        ? notes
        : notes.filter((note: Note) => {
            const noteType = note.type || "text";
            if (noteType === "text") {
              return formatToPlainText((note as TextNote).text?.toLowerCase()).includes(text);
            } else if (noteType === "code") {
              return (note as CodeNote).tabs?.some((tab) => tab.code?.toLowerCase().includes(text));
            } else if (noteType === "todo") {
              return (note as TodoNote).list?.find((item: TodoItem) => item.text?.toLowerCase().includes(text));
            } else {
              return false;
            }
          });
    }
  }, [filterText, deepFilterText, showDeepSearch, notes]);

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

  // check trashed notes data and delete
  useEffect(() => {
    const isUnlimitedTrash = devMode.enabled && devMode.unlimitedTrashTime;
    if (isUnlimitedTrash) return;

    trashedNotes.forEach((note: Note) => {
      const currentDate = new Date().getTime();

      if (note.deleteDate != null && currentDate > note.deleteDate) {
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
    const resetStates = navigation.addListener("focus", () => {
      Keyboard.dismiss();
      setSelectedNotes([]);
      setIsDeleteMode(false);
      setFilterText("");
    });
    return resetStates;
  }, [navigation]);

  // animations
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const height = useSharedValue(1);

  const animatedOpacity = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedMaxHeight = useAnimatedStyle(() => ({
    maxHeight: `${height.value * 100}%`,
  }));

  useEffect(() => {
    if (isDeleteMode) {
      opacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
      translateY.value = withTiming(-125, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
      height.value = withTiming(0.8, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      opacity.value = withTiming(0, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
      height.value = withTiming(1, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeleteMode]);

  // changelog for new version
  useEffect(() => {
    const checkVersion = async () => {
      const lastAppVersion = await AsyncStorage.getItem("@appVersion");

      const currentAppVersion = Platform.OS === "web" ? configs.app.version.web : configs.app.version.mobile;

      if (lastAppVersion != null && lastAppVersion == currentAppVersion) {
        // no changelog to show -> the vault prompt may appear right away
        setChangelogChecked(true);
        return;
      }

      setTimeout(() => {
        router.push("/changelog");
        AsyncStorage.setItem("@appVersion", currentAppVersion);
        // mark settled at push time: home is now unfocused (changelog on top), so
        // the vault prompt stays hidden until the user returns from the changelog
        setChangelogChecked(true);
      }, 750);
    };

    checkVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filters

  const toggleDeepSearch = () => {
    setShowDeepSearch((p: boolean) => !p);
    setFilterText("");
    setDeepFilterText("");
  };

  return (
    <>
      <ConfirmOrCancelDialog
        open={showDeleteNotesDialog}
        description={t("popup.delete_notes")}
        onCancel={() => {
          toggleDeleteMode();
          setShowDeleteNotesDialog(false);
        }}
        onConfirm={() => {
          temporaryDeleteSelectedNotesFromItems();
          setShowDeleteNotesDialog(false);
        }}
      />

      <VaultPromptDialog
        open={vaultPromptNeeded && !vaultUnlocked && isFocused && changelogChecked}
        onClose={() => setVaultPromptNeeded(false)}
        onGo={() => {
          setVaultPromptNeeded(false);
          router.push("/settings/cloud-sync/connect");
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.row}>
            <Sidebar />
            <Animated.View style={[styles.main, animatedMaxHeight]}>
              <View style={styles.header}>
                <View style={styles.titleBlock}>
                  <Text style={styles.headerTitle}>{t("home.notes")}</Text>

                  <View style={styles.headerMeta}>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {currentCategory.name != "All" ? currentCategory.name : t("All")}
                    </Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{filteredNotes.length}</Text>
                    </View>
                  </View>
                </View>

                {isDeleteMode && (
                  <View style={styles.headerActions}>
                    <DeleteNotesButton onPressDelete={() => setShowDeleteNotesDialog(true)} />
                  </View>
                )}
              </View>

              <View style={styles.searchRow}>
                <SearchInput
                  value={!showDeepSearch ? filterText : deepFilterText}
                  onChangeText={!showDeepSearch ? setFilterText : setDeepFilterText}
                  placeholder={!showDeepSearch ? t("home.search") : t("home.deepSearch")}
                  icon={showDeepSearch ? <DocumentMagnifyingGlassIcon size={18} color={COLOR.softWhite} /> : undefined}
                  containerStyle={styles.searchInputFlex}
                />

                <NoteFiltersButton
                  filters={{
                    showDeepSearch,
                    toggleDeepSearch,
                  }}
                />
              </View>

              <FlashList
                maintainVisibleContentPosition={{
                  disabled: true,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                data={filteredNotes}
                extraData={{ isDeleteMode }}
                renderItem={({ item }) => (
                  <NoteCard
                    content={item}
                    isSelected={selectedNotes.includes(`${item.id}|${item.locked}`)}
                    selectNote={selectNote}
                    isDeleteMode={isDeleteMode}
                    toggleDeleteMode={toggleDeleteMode}
                  />
                )}
                keyExtractor={(item) => item.id}
              />
            </Animated.View>
          </View>
        </SafeAreaView>

        <Animated.View style={[styles.editModeToolbar, animatedTranslate, animatedOpacity]}>
          <FavoriteNotesButton onPressSave={toggleImportantNotesFromItems} />

          <ProtectNotesButton onPressProtect={toggleProtectedNotesFromItems} />

          <HiddenNotesButton onPressHidden={toggleHiddenNotesFromItems} />

          <ReadOnlyNotesButton onPressReadOnly={toggleReadOnlyNotesFromItems} />
        </Animated.View>

        <AddNoteOverlayButton isDeleteMode={isDeleteMode} toggleDeleteMode={toggleDeleteMode} />
      </KeyboardAvoidingView>
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  safe: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
  main: {
    flex: 1,
    overflow: "hidden",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  searchInputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  saveNoteButton: {
    marginBottom: PADDING_MARGIN.sm,
    marginRight: PADDING_MARGIN.lg,
  },
  deleteNoteButton: {
    marginBottom: PADDING_MARGIN.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  titleBlock: {
    flexShrink: 1,
    marginRight: PADDING_MARGIN.md,
  },
  headerTitle: {
    fontSize: FONTSIZE.title,
    fontFamily: FONT.bold,
    color: COLOR.textPrimary,
    letterSpacing: -0.5,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.xs,
  },
  categoryName: {
    flexShrink: 1,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
    overflow: "hidden",
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
  countBadge: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fillStrong,
    overflow: "hidden",
  },
  countText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
  },
  editModeToolbar: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surfaceMuted,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    bottom: -58,
    right: 110,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  loadingText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
