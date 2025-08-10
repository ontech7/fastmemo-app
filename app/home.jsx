import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { configs } from "@/configs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Animated, BackHandler, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector, useStore } from "react-redux";

import { popupAlert } from "@/utils/alert";
import { toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";
import Sidebar from "@/components/Sidebar";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import AddNoteTextButton from "../components/buttons/AddNoteTextButton";
import AddNoteTodoButton from "../components/buttons/AddNoteTodoButton";
import DeleteNotesButton from "../components/buttons/DeleteNotesButton";
import FavoriteNotesButton from "../components/buttons/FavoriteNotesButton";
import HiddenNotesButton from "../components/buttons/HiddenNotesButton";
import ProtectNotesButton from "../components/buttons/ProtectNotesButton";
import ReadOnlyNotesButton from "../components/buttons/ReadOnlyNotesButton";
import NoteCard from "../components/cards/NoteCard";
import SearchNotesInput from "../components/inputs/SearchNotesInput";
import { getCurrentCategory } from "../slicers/categoriesSlice";
import {
  deleteNote,
  getNotesFilteredPerCategory,
  temporaryDeleteSelectedNotes,
  toggleHiddenNotes,
  toggleImportantNotes,
  toggleProtectedNotes,
  toggleReadOnlyNotes,
} from "../slicers/notesSlice";
import {
  selectorIsFingerprintEnabled,
  selectorShowHidden,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "../slicers/settingsSlice";

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

  const [filterText, setFilterText] = useState("");
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState([]);

  const is_protected_note = selectedNotes.some((id) => id.split("|")[1] == "true");

  const temporaryDeleteSelectedNotesFromItems = () => {
    const deleteNotes = () =>
      popupAlert(t("warning"), t("popup.delete_notes"), {
        confirmText: t("delete"),
        confirmHandler: () => {
          dispatch(temporaryDeleteSelectedNotes(selectedNotes));
          webhook(webhook_temporaryDeleteNote, {
            action: "note/temporaryDeleteNote",
            extra: "multiple",
            ids: selectedNotes.map((noteId) => noteId.split("|")[0]),
          });
          setSelectedNotes([]);
          setIsDeleteMode(false);
        },
      });

    if (is_protected_note) {
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

  const renderItem = ({ item }) => (
    <NoteCard
      content={item}
      isSelected={selectedNotes.includes(`${item.id}|${item.locked}`)}
      selectNote={selectNote}
      isDeleteMode={isDeleteMode}
      toggleDeleteMode={toggleDeleteMode}
    />
  );

  const filteredNotes = useMemo(() => {
    if (!filterText.trim()) {
      return notes;
    }

    return notes.filter((note) => note.title?.toLowerCase().includes(filterText.toLowerCase()));
  }, [filterText, notes]);

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
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const opacityInterpolation = opacityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateAnim = useRef(new Animated.Value(0)).current;
  const translateInterpolation = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -105],
  });

  const heightAnim = useRef(new Animated.Value(0)).current;
  const heightInterpolation = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["100%", "85%"],
  });

  useEffect(() => {
    const translateAnimation = Animated.timing(translateAnim, {
      toValue: isDeleteMode ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });

    const opacityAnimation = Animated.timing(opacityAnim, {
      toValue: isDeleteMode ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });

    const heightAnimation = Animated.timing(heightAnim, {
      toValue: isDeleteMode ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });

    translateAnimation.start();
    opacityAnimation.start();
    heightAnimation.start();

    return () => {
      translateAnimation.stop();
      opacityAnimation.stop();
      heightAnimation.stop();
    };
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={styles.container}>
        <Sidebar />

        <SafeAreaView style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1,
              borderRadius: BORDER.normal,
              overflow: "hidden",
              maxHeight: heightInterpolation,
            }}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{t("home.notes")}</Text>

                <Text style={styles.categoryName}>{currentCategory.name != "All" ? currentCategory.name : t("All")}</Text>
              </View>

              {isDeleteMode && (
                <View style={styles.deleteModeContainer}>
                  <DeleteNotesButton onPressDelete={temporaryDeleteSelectedNotesFromItems} />
                </View>
              )}
            </View>

            <SearchNotesInput text={filterText} onChangeText={setFilterText} />

            <FlashList
              showsVerticalScrollIndicator={false}
              data={filteredNotes}
              extraData={{ isDeleteMode }}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={79}
            />
          </Animated.View>
        </SafeAreaView>

        <Animated.View
          style={[
            styles.editModeToolbar,
            { transform: [{ translateY: translateInterpolation }] },
            { opacity: opacityInterpolation },
          ]}
        >
          <FavoriteNotesButton onPressSave={toggleImportantNotesFromItems} />

          <ProtectNotesButton onPressProtect={toggleProtectedNotesFromItems} />

          <HiddenNotesButton onPressHidden={toggleHiddenNotesFromItems} />

          <ReadOnlyNotesButton onPressReadOnly={toggleReadOnlyNotesFromItems} />
        </Animated.View>

        <AddNoteTodoButton isDeleteMode={isDeleteMode} toggleDeleteMode={toggleDeleteMode} />

        <AddNoteTextButton isDeleteMode={isDeleteMode} toggleDeleteMode={toggleDeleteMode} />
      </View>
    </KeyboardAvoidingView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
    height: SIZE.full,
    flexDirection: "row",
  },
  deleteModeContainer: {
    flexDirection: "row",
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
