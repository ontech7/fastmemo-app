import { useCallback, useEffect, useMemo, useState } from "react";
import { configs } from "@/configs";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";
import { BackHandler, Platform, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useDispatch, useSelector, useStore } from "react-redux";

import Haptics from "@/libs/haptics";
import { AsyncStorage } from "@/libs/storage";
import { toggleWithSecret } from "@/utils/crypt";
import { formatToPlainText } from "@/utils/string";
import { webhook } from "@/utils/webhook";
import { useRouter } from "@/hooks/useRouter";
import AddNoteOverlayButton from "@/components/buttons/AddNoteOverlayButton";
import DeleteNotesButton from "@/components/buttons/DeleteNotesButton";
import FavoriteNotesButton from "@/components/buttons/FavoriteNotesButton";
import HiddenNotesButton from "@/components/buttons/HiddenNotesButton";
import NoteFiltersButton from "@/components/buttons/NoteFiltersButton";
import ProtectNotesButton from "@/components/buttons/ProtectNotesButton";
import ReadOnlyNotesButton from "@/components/buttons/ReadOnlyNotesButton";
import NoteCard from "@/components/cards/NoteCard";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SearchNotesInput from "@/components/inputs/SearchNotesInput";
import SafeAreaView from "@/components/SafeAreaView";
import Sidebar from "@/components/Sidebar";
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
  selectorIsFingerprintEnabled,
  selectorShowHidden,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function HomeScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const store = useStore();

  const currentCategory = useSelector(getCurrentCategory);
  const showHidden = useSelector(selectorShowHidden);
  const notes = useSelector(getNotesFilteredPerCategory(currentCategory, showHidden));

  // @ts-ignore
  const trashedNotes = store.getState().notes.temporaryItems;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const dispatch = useDispatch();

  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const [showDeepSearch, setShowDeepSearch] = useState(false);
  const [deepFilterText, setDeepFilterText] = useState("");
  const [filterText, setFilterText] = useState("");

  const [selectedNotes, setSelectedNotes] = useState([]);
  const isNoteProtected = selectedNotes.some((id) => id.split("|")[1] == "true");

  const [showDeleteNotesDialog, setShowDeleteNotesDialog] = useState(false);

  const temporaryDeleteSelectedNotesFromItems = () => {
    const deleteNotes = () => {
      dispatch(temporaryDeleteSelectedNotes(selectedNotes));
      webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        extra: "multiple",
        ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
      });
      setSelectedNotes([]);
      setIsDeleteMode(false);
    };

    if (isNoteProtected) {
      toggleWithSecret({
        router,
        isFingerprintEnabled: selectorFingerprintEnabled,
        callback: deleteNotes,
      });
    } else {
      deleteNotes();
    }
  };

  const toggleImportantNotesFromItems = () => {
    dispatch(toggleImportantNotes(selectedNotes));
    webhook(webhook_updateNote, {
      action: "note/updateNote",
      extra: "multiple",
      ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
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
      ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
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
      ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
      property: "hidden",
    });
    setSelectedNotes([]);
    setIsDeleteMode(false);
  };

  const toggleProtectedNotesFromItems = () => {
    if (!selectorFingerprintEnabled) {
      router.push({
        pathname: "/secret-code",
        params: {
          startPhase: "toggleProtectedSelectedNotes",
          selectedNotes,
        },
      });
      webhook(webhook_updateNote, {
        action: "note/updateNote",
        extra: "multiple",
        ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
        property: "locked",
      });
      setSelectedNotes([]);
      setIsDeleteMode(false);
      return;
    }

    LocalAuthentication.authenticateAsync().then((authResult) => {
      if (authResult?.success) {
        dispatch(toggleProtectedNotes(selectedNotes));
        webhook(webhook_updateNote, {
          action: "note/updateNote",
          extra: "multiple",
          ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
          property: "locked",
        });
        setSelectedNotes([]);
        setIsDeleteMode(false);
      }
    });
  };

  const toggleDeleteMode = useCallback(() => {
    if (isDeleteMode) setSelectedNotes([]);
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
    const text = !showDeepSearch ? filterText.trim().toLowerCase() : deepFilterText.trim().toLowerCase();

    if (!showDeepSearch) {
      return !text ? notes : notes.filter((note) => note.title?.toLowerCase().includes(filterText.toLowerCase()));
    } else {
      return !text
        ? notes
        : notes.filter((note) => {
            if ((note.type || "text") === "text") {
              return formatToPlainText(note.text?.toLowerCase()).includes(text);
            } else {
              return note.list.find((item) => item.text?.toLowerCase().includes(text));
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
    trashedNotes.forEach((note) => {
      const currentDate = new Date();

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
    const resetStates = navigation.addListener("focus", () => {
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
  }, [isDeleteMode]);

  // changelog for new version
  useEffect(() => {
    const checkVersion = async () => {
      const lastAppVersion = await AsyncStorage.getItem("@appVersion");

      if (lastAppVersion != null && lastAppVersion == configs.app.version) {
        return;
      }

      setTimeout(() => {
        router.push("/changelog");
        AsyncStorage.setItem("@appVersion", configs.app.version);
      }, 750);
    };

    checkVersion();
  }, []);

  // filters

  const toggleDeepSearch = () => {
    setShowDeepSearch((p) => !p);
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
                  <NoteFiltersButton
                    filters={{
                      showDeepSearch,
                      toggleDeepSearch,
                    }}
                  />
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
    gap: PADDING_MARGIN.md,
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
});
