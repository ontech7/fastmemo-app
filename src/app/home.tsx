import AddNoteOverlayButton from "@/components/buttons/AddNoteOverlayButton";
import DeleteNotesButton from "@/components/buttons/DeleteNotesButton";
import FavoriteNotesButton from "@/components/buttons/FavoriteNotesButton";
import HiddenNotesButton from "@/components/buttons/HiddenNotesButton";
import NoteFiltersButton from "@/components/buttons/NoteFiltersButton";
import ProtectNotesButton from "@/components/buttons/ProtectNotesButton";
import ReadOnlyNotesButton from "@/components/buttons/ReadOnlyNotesButton";
import NoteCard from "@/components/cards/NoteCard";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import UpdateAvailableDialog from "@/components/dialogs/UpdateAvailableDialog";
import SearchNotesInput from "@/components/inputs/SearchNotesInput";
import SafeAreaView from "@/components/SafeAreaView";
import Sidebar from "@/components/Sidebar";
import { configs } from "@/configs";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";
import useNetInfo from "@/hooks/useNetInfo";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { checkLatestAppVersion } from "@/libs/api/checkLatestVersion";
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
  selectorAIAssistant,
  selectorDeveloperMode,
  selectorShowHidden,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import type { CodeNote, Note, TextNote, TodoItem, TodoNote } from "@/types";
import { openUrl } from "@/utils/openUrl";
import { formatToPlainText } from "@/utils/string";
import { getCurrentAppVersion, isDesktopOrWeb, isNewerVersion, pickUpdateUrl } from "@/utils/version";
import { webhook } from "@/utils/webhook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SparklesIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useDispatch, useSelector, useStore } from "react-redux";

export default function HomeScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const store = useStore();

  const aiSettings = useSelector(selectorAIAssistant);

  const currentCategory = useSelector(getCurrentCategory);
  const showHidden = useSelector(selectorShowHidden);
  const notes = useSelector(getNotesFilteredPerCategory(currentCategory, showHidden));

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

  const [updateInfo, setUpdateInfo] = useState<{ latestVersion: string; releaseUrl: string } | null>(null);

  const { isConnected } = useNetInfo();

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
        return;
      }

      setTimeout(() => {
        router.push("/changelog");
        AsyncStorage.setItem("@appVersion", currentAppVersion);
      }, 750);
    };

    checkVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // check for a newer version on the remote API and prompt the user to update
  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;

    const checkLatest = async () => {
      const data = await checkLatestAppVersion();
      if (cancelled || !data) return;

      const latest = isDesktopOrWeb() ? data.desktop.version : data.mobile.version;
      const current = getCurrentAppVersion();

      if (isNewerVersion(current, latest)) {
        setUpdateInfo({ latestVersion: latest, releaseUrl: data.releaseUrl });
      }
    };

    checkLatest();

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const onConfirmUpdate = useCallback(() => {
    if (!updateInfo) return;
    openUrl(pickUpdateUrl(updateInfo.releaseUrl));
  }, [updateInfo]);

  // filters

  const toggleDeepSearch = () => {
    setShowDeepSearch((p: boolean) => !p);
    setFilterText("");
    setDeepFilterText("");
  };

  return (
    <>
      <UpdateAvailableDialog
        open={updateInfo != null}
        latestVersion={updateInfo?.latestVersion ?? ""}
        onConfirm={onConfirmUpdate}
      />

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

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <Sidebar />
        <SafeAreaView style={{ flex: 1 }}>
          <Animated.View
            style={[
              {
                flex: 1,
                overflow: "hidden",
              },
              animatedMaxHeight,
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{t("home.notes")}</Text>

                <Text style={styles.categoryName}>{currentCategory.name != "All" ? currentCategory.name : t("All")}</Text>
              </View>

              <View style={styles.topContainer}>
                {isDeleteMode ? (
                  <DeleteNotesButton onPressDelete={() => setShowDeleteNotesDialog(true)} />
                ) : (
                  <>
                    {Platform.OS !== "web" && !aiSettings.enabled && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push("/settings/ai-assistant")}
                        style={styles.aiButton}
                      >
                        <SparklesIcon color={COLOR.softWhite} size={28} />
                      </TouchableOpacity>
                    )}
                    <NoteFiltersButton
                      filters={{
                        showDeepSearch,
                        toggleDeepSearch,
                      }}
                    />
                  </>
                )}
              </View>
            </View>

            <SearchNotesInput
              text={!showDeepSearch ? filterText : deepFilterText}
              onChangeText={!showDeepSearch ? setFilterText : setDeepFilterText}
              showDeepSearch={showDeepSearch}
            />

            <FlashList
              maintainVisibleContentPosition={{
                disabled: true,
              }}
              showsVerticalScrollIndicator={false}
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
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
    flexDirection: "row",
    height: SIZE.full,
  },
  topContainer: {
    flexDirection: "row",
    gap: PADDING_MARGIN.lg,
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
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  headerTitle: {
    fontSize: FONTSIZE.title,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  categoryName: {
    color: COLOR.lightBlue,
    fontWeight: FONTWEIGHT.semiBold,
  },
  editModeToolbar: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
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
  aiButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  aiButtonIcon: {
    width: 40,
    height: 40,
  },
});
