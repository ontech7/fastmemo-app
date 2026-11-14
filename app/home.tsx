import AddNoteOverlayButton from "@/components/buttons/AddNoteOverlayButton";
import DeleteNotesButton from "@/components/buttons/DeleteNotesButton";
import NoteFiltersButton from "@/components/buttons/NoteFiltersButton";
import NoteCard from "@/components/cards/NoteCard";
import TagRow from "@/components/cards/TagRow";
import CloudUnreachableLine from "@/components/cloud/CloudUnreachableLine";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import VaultPromptDialog from "@/components/dialogs/VaultPromptDialog";
import SearchInput from "@/components/inputs/SearchInput";
import QuickNoteBar, { QUICK_NOTE_BAR_RESERVED } from "@/components/notes/QuickNoteBar";
import SelectionBar, { SELECTION_BAR_RESERVED } from "@/components/notes/SelectionBar";
import SafeAreaView from "@/components/SafeAreaView";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/ui/EmptyState";
import TourSpotlight from "@/components/ui/TourSpotlight";
import WebViewWarmup from "@/components/WebViewWarmup";
import { configs } from "@/configs";
import { DURATION } from "@/constants/motion";
import { BORDER, COLOR, FONT, FONTSIZE, FONTWEIGHT, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useCloudStatus } from "@/hooks/useCloudStatus";
import { useNoteSearch } from "@/hooks/useNoteSearch";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { useVaultPrompt } from "@/hooks/useVaultPrompt";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { setListHost } from "@/libs/desktopList";
import { addTrail } from "@/libs/diagnostics";
import Haptics from "@/libs/haptics";
import { type AppStore as HistoryStore, startHistory } from "@/libs/history";
import type { SearchHit } from "@/libs/search/search";
import type { TagCount } from "@/libs/search/tags";
import { windowReady } from "@/libs/windowReady";
import { setVaultPromptNeeded } from "@/libs/vaultPrompt";
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
  selectorNoteCreation,
  selectorShowHidden,
  selectorTourStep,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
  setTourStep,
} from "@/slicers/settingsSlice";
import type { Category, Note, RootState } from "@/types";
import { webhook } from "@/utils/webhook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useFocusEffect, useIsFocused, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, StyleSheet, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector, useStore } from "react-redux";

/** What the home's list holds: notes, and while searching the groups' headings and the tags. */
type HomeRow =
  | { kind: "note"; note: Note; hit?: SearchHit }
  | { kind: "header"; id: string; title: string; count?: number }
  | { kind: "tag"; tag: TagCount };

/** The search reads every category: the home's selector, with "All". */
const ALL_CATEGORIES: Category = { order: 0, name: "All", icon: "", index: true, selected: false };

export default function HomeScreen() {
  const { t } = useTranslation();

  // Desktop: the window, hidden at launch, shows now that home is drawn (the first launch shows it for the logo
  // animation already).
  useEffect(() => {
    windowReady();
  }, []);

  const router = useRouter();
  const cloudStatus = useCloudStatus();

  const isFocused = useIsFocused();
  const vaultPromptNeeded = useVaultPrompt();
  const vaultUnlocked = useVaultUnlocked();
  // Gate the vault prompt until the version/changelog check has settled, so it
  // never overlaps the changelog screen that opens on a version bump.
  const [changelogChecked, setChangelogChecked] = useState(false);

  const store = useStore();

  // After the first draw: the versions of a note deleted for good go with it, and the history is swept once (spec B.9).
  useEffect(() => startHistory(store as unknown as HistoryStore), [store]);

  const currentCategory = useSelector(getCurrentCategory);
  const showHidden = useSelector(selectorShowHidden);
  // Keep the memoized selector instance stable across renders — building it inline
  // on every render gives reselect an empty cache each time, so `notes` would be a
  // fresh array on every render and rebuild the whole list (jank while typing).
  const selectNotes = useMemo(() => getNotesFilteredPerCategory(currentCategory, showHidden), [currentCategory, showHidden]);
  const notes = useSelector(selectNotes);
  const selectAllNotes = useMemo(() => getNotesFilteredPerCategory(ALL_CATEGORIES, showHidden), [showHidden]);
  const allNotes = useSelector(selectAllNotes);

  // @ts-ignore
  const trashedNotes = store.getState().notes.temporaryItems;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const devMode = useSelector(selectorDeveloperMode);

  const dispatch = useDispatch();

  const insets = useSafeAreaInsets();

  const noteCreation = useSelector(selectorNoteCreation);
  const tourStep = useSelector(selectorTourStep);
  // Default ON for state persisted before the setting existed.
  const quickNoteEnabled = noteCreation.quickNote ?? true;

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  // Live height the quick-note bar reports, so the FAB can ride just above it.
  const [barHeight, setBarHeight] = useState(QUICK_NOTE_BAR_RESERVED);

  const [filterText, setFilterText] = useState("");

  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);

  const [showDeleteNotesDialog, setShowDeleteNotesDialog] = useState(false);
  // Desktop: the note Delete asks about ("id|locked").
  const [trashOne, setTrashOne] = useState<string | null>(null);

  const { unlockWithSecret } = useSecret();

  // `ids` are "id|locked", as the selection holds them: the selection, or the one note the desktop's Delete marked.
  const temporaryDeleteSelectedNotesFromItems = (ids: string[] = selectedNotes) => {
    const deleteNotes = () => {
      dispatch(temporaryDeleteSelectedNotes(ids));
      webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        extra: "multiple",
        ids: ids.map((noteId: string) => noteId.split("|")[0]),
      });
      setSelectedNotes([]);
      setIsDeleteMode(false);
    };

    if (ids.some((id: string) => id.split("|")[1] === "true")) {
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
    // The selection bar sits at the bottom: no keyboard (the search's) over it.
    else Keyboard.dismiss();
    setIsDeleteMode((p: boolean) => !p);
  }, [isDeleteMode]);

  // A haptic for each card picked or let go (the long press that opens the mode picks one: one haptic).
  const selectNote = useCallback((currId: string, currLocked: boolean) => {
    const idAndLocked = `${currId}|${currLocked}`;
    Haptics.selectionAsync();

    setSelectedNotes((prevIds: string[]) => {
      if (prevIds.includes(idAndLocked)) {
        return prevIds.filter((prevId: string) => !prevId.includes(idAndLocked));
      } else {
        return [...prevIds, idAndLocked];
      }
    });
  }, []);

  // One search over every category's notes: titles and content of every type, protected notes by title only (no
  // secret code to search), hidden ones only while shown.
  const searchResult = useNoteSearch(allNotes, filterText, {
    categoryIcon: currentCategory.index ? null : currentCategory.icon,
    showHidden,
  });
  const searching = searchResult !== null;

  // Once each time the field goes from empty to not empty: never the text.
  const typing = filterText.trim() !== "";
  useEffect(() => {
    if (typing) addTrail("search");
  }, [typing]);

  const categoryLabel = currentCategory.name !== "All" ? currentCategory.name : t("All");
  const rows = useMemo((): HomeRow[] => {
    if (!searchResult) return notes.map((note) => ({ kind: "note", note }));
    const out: HomeRow[] = [];
    if (searchResult.tags.length) {
      out.push({ kind: "header", id: "tags", title: t("home.tags_title") });
      for (const tag of searchResult.tags) out.push({ kind: "tag", tag });
    }
    const { here, elsewhere } = searchResult;
    if (here.length && elsewhere.length) {
      out.push({ kind: "header", id: "here", title: t("home.search_in", { category: categoryLabel }), count: here.length });
    }
    for (const hit of here) out.push({ kind: "note", note: hit.note, hit });
    if (elsewhere.length) {
      out.push({ kind: "header", id: "elsewhere", title: t("home.search_elsewhere"), count: elsewhere.length });
      for (const hit of elsewhere) out.push({ kind: "note", note: hit.note, hit });
    }
    return out;
  }, [searchResult, notes, t, categoryLabel]);
  // "The notes on screen": the count next to the category, and what the selection works on.
  const noteCount = useMemo(() => rows.reduce((count, row) => count + (row.kind === "note" ? 1 : 0), 0), [rows]);

  const searchTag = useCallback((tag: TagCount) => setFilterText("#" + tag.label), []);

  // Stable across unrelated re-renders (focus changes, quick-note bar height, ...), so FlashList
  // only re-renders its cells when the selection or delete mode actually change (LL-019).
  const renderRow = useCallback(
    ({ item, index }: { item: HomeRow; index: number }) => {
      if (item.kind === "header") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.count !== undefined && <Text style={styles.sectionTitle}>{item.count}</Text>}
          </View>
        );
      }
      if (item.kind === "tag") return <TagRow tag={item.tag} onPress={searchTag} />;
      return (
        <NoteCard
          content={item.note}
          hit={item.hit}
          isSelected={selectedNotes.includes(`${item.note.id}|${item.note.locked}`)}
          selectNote={selectNote}
          isDeleteMode={isDeleteMode}
          toggleDeleteMode={toggleDeleteMode}
          // The tour's last step points at the first note.
          tourTarget={tourStep === "explore" && index === 0 ? "firstNote" : undefined}
        />
      );
    },
    [selectedNotes, selectNote, isDeleteMode, toggleDeleteMode, tourStep, searchTag]
  );
  // Desktop (spec C.1): while the home has the focus, the keyboard's list is the notes on screen. The list is handed over
  // when the home gains the focus and kept up to date while it has it, never dropped in between (dropping it is how the
  // list knows the home went away and came back).
  const listRef = useRef<FlashListRef<HomeRow>>(null);
  const noteIds = useMemo(() => rows.flatMap((row) => (row.kind === "note" ? [row.note.id] : [])), [rows]);
  const listHost = useMemo(
    () => ({
      ids: noteIds,
      trash: (noteId: string) => {
        const row = rows.find((r) => r.kind === "note" && r.note.id === noteId);
        if (row?.kind === "note") setTrashOne(`${noteId}|${row.note.locked}`);
      },
      scrollTo: (noteId: string) => {
        const index = rows.findIndex((r) => r.kind === "note" && r.note.id === noteId);
        if (index >= 0) void listRef.current?.scrollToIndex({ index, animated: false });
      },
    }),
    [noteIds, rows]
  );
  const listHostRef = useRef(listHost);
  useEffect(() => {
    listHostRef.current = listHost;
    if (isFocused) setListHost(listHost);
  }, [listHost, isFocused]);
  useEffect(() => {
    if (!isFocused) return;
    setListHost(listHostRef.current);
    return () => setListHost(null);
  }, [isFocused]);

  const listExtraData = useMemo(() => ({ isDeleteMode, selectedNotes, tourStep }), [isDeleteMode, selectedNotes, tourStep]);

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
    });
    return resetStates;
  }, [navigation]);

  // Select mode moves things by transforms and fades only: the list keeps its height (no relayout). The selection bar
  // fades in at the bottom of the column as the quick note bar fades out (both `hidden`), the trash chip fades in the
  // header and the add button slides to just above the selection bar (AddNoteOverlayButton).
  const chipShown = useSharedValue(0);

  useEffect(() => {
    chipShown.value = withTiming(isDeleteMode ? 1 : 0, { duration: DURATION.fast });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeleteMode]);

  const chipStyle = useAnimatedStyle(() => ({ opacity: chipShown.value }));

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

  // Lift the FAB to sit just above the quick-note bar (which grows with its text):
  // clear the bottom safe-area inset + the bar's reported height + a gap. The bar
  // shows only when enabled and not selecting; otherwise the FAB keeps its place.
  const fabBottom = insets.bottom + barHeight + PADDING_MARGIN.xl;

  // While selecting, the add button rides just above the selection bar, and the end of the list scrolls clear of it:
  // the bar's height and a gap, less what the quick note bar (its top margin included) already keeps below the list.
  const [selectionBarHeight, setSelectionBarHeight] = useState(SELECTION_BAR_RESERVED);
  const selectFabBottom = insets.bottom + selectionBarHeight + PADDING_MARGIN.lg;
  const selectPadding = Math.max(
    0,
    selectionBarHeight + PADDING_MARGIN.md - (quickNoteEnabled ? barHeight + PADDING_MARGIN.md : 0)
  );
  const listEmpty = rows.length === 0;
  const listContentStyle = useMemo(
    () => ({ paddingBottom: isDeleteMode ? selectPadding : 0, flexGrow: listEmpty ? 1 : undefined }),
    [isDeleteMode, selectPadding, listEmpty]
  );

  // An empty list says why (spec 5.3): a search with no match, or no notes ("All") or none in this category. Hidden
  // notes with "show hidden" off count as no notes: nothing hints at them.
  const emptyState = useMemo(
    () =>
      searching ? (
        <EmptyState variant="search" />
      ) : currentCategory.index ? (
        <EmptyState variant="notes" quickNote={quickNoteEnabled} />
      ) : (
        <EmptyState variant="category" categoryIcon={currentCategory.icon} />
      ),
    [searching, currentCategory.index, currentCategory.icon, quickNoteEnabled]
  );

  // The first-note tour's steps on this screen (once the changelog check has settled; not over the note-type menu).
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const showTour = isFocused && changelogChecked && !isDeleteMode && !typeMenuOpen;

  // A tour left on its editor step (the app closed in the editor) goes on here, with the list's step.
  useFocusEffect(
    useCallback(() => {
      if (selectorTourStep(store.getState() as RootState) === "write") dispatch(setTourStep("explore"));
    }, [store, dispatch])
  );

  return (
    <>
      <ConfirmOrCancelDialog
        open={showDeleteNotesDialog}
        destructive
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

      <ConfirmOrCancelDialog
        open={trashOne !== null}
        destructive
        description={t("popup.delete_note")}
        onCancel={() => setTrashOne(null)}
        onConfirm={() => {
          if (trashOne) temporaryDeleteSelectedNotesFromItems([trashOne]);
          setTrashOne(null);
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

      <View style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.row}>
            <Sidebar />
            <View style={styles.main}>
              <View style={styles.header}>
                <View style={styles.titleBlock}>
                  <Text style={styles.headerTitle}>{t("home.notes")}</Text>

                  {/* the cloud out of reach takes the category's place, until it answers (ADR-029) */}
                  {cloudStatus.unreachable ? (
                    <CloudUnreachableLine lastContact={cloudStatus.lastContact} />
                  ) : (
                    <View style={styles.headerMeta}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {currentCategory.name != "All" ? currentCategory.name : t("All")}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>{noteCount}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Always mounted (no relayout on entering the mode): faded out, it takes no touch, focus or screen reader. */}
                <Animated.View
                  style={[styles.headerActions, chipStyle, { pointerEvents: isDeleteMode ? "auto" : "none" }]}
                  aria-hidden={!isDeleteMode}
                >
                  <DeleteNotesButton onPressDelete={() => setShowDeleteNotesDialog(true)} focusable={isDeleteMode} />
                </Animated.View>
              </View>

              <View style={styles.searchRow}>
                <SearchInput
                  value={filterText}
                  onChangeText={setFilterText}
                  placeholder={t("home.search")}
                  containerStyle={styles.searchInputFlex}
                />

                <NoteFiltersButton />
              </View>

              <View style={styles.listWrapper}>
                <FlashList
                  ref={listRef}
                  maintainVisibleContentPosition={{
                    disabled: true,
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  data={rows}
                  extraData={listExtraData}
                  renderItem={renderRow}
                  keyExtractor={keyExtractor}
                  getItemType={getItemType}
                  contentContainerStyle={listContentStyle}
                  ListEmptyComponent={emptyState}
                />
              </View>

              {/* Quick-note bar lives in normal flow at the bottom of the list column so it
                  aligns with the cards. Wrapping it in a KeyboardStickyView (transform, no
                  relayout) makes it track the keyboard 1:1 instead of lagging behind a
                  layout-animating KeyboardAvoidingView. `opened: insets.bottom` cancels the
                  bottom inset the keyboard already covers, so it rests just above the keyboard.
                  Faded out in select mode, still mounted: the list keeps its height and the text stays. */}
              {quickNoteEnabled && (
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                  <QuickNoteBar onHeightChange={setBarHeight} hidden={isDeleteMode} />
                </KeyboardStickyView>
              )}

              {/* Select mode's actions, in the quick note bar's place (over the end of the list when quick note is off). */}
              <SelectionBar
                hidden={!isDeleteMode}
                onHeightChange={setSelectionBarHeight}
                onImportant={toggleImportantNotesFromItems}
                onProtect={toggleProtectedNotesFromItems}
                onHide={toggleHiddenNotesFromItems}
                onReadOnly={toggleReadOnlyNotesFromItems}
              />
            </View>
          </View>
        </SafeAreaView>

        <WebViewWarmup />

        <AddNoteOverlayButton
          isDeleteMode={isDeleteMode}
          toggleDeleteMode={toggleDeleteMode}
          bottomOffset={quickNoteEnabled ? fabBottom : undefined}
          selectBottom={selectFabBottom}
          onMenuToggle={setTypeMenuOpen}
        />

        {showTour && tourStep === "create" && (
          <TourSpotlight
            targets={["addNoteGroup"]}
            pointAt="addNote"
            passThrough
            step={1}
            total={3}
            title={t("tour.create_title")}
            text={t("tour.create_text")}
            onSkip={() => dispatch(setTourStep("done"))}
          />
        )}
        {showTour && tourStep === "explore" && (
          <TourSpotlight
            targets={["firstNote", "sidebar"]}
            step={3}
            total={3}
            title={t("tour.explore_title")}
            text={t("tour.explore_text")}
            actionLabel={t("tour.got_it")}
            onAction={() => dispatch(setTourStep("done"))}
          />
        )}
      </View>
    </>
  );
}

const keyExtractor = (row: HomeRow) =>
  row.kind === "note" ? "note:" + row.note.id : row.kind === "tag" ? "tag:" + row.tag.key : "header:" + row.id;
const getItemType = (row: HomeRow) => row.kind;

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  listWrapper: {
    flex: 1,
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
  // A search's groups ("In Work", "Other categories") and the tag list's heading, with their counts.
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.xs,
    paddingTop: PADDING_MARGIN.xs,
    paddingBottom: PADDING_MARGIN.sm,
  },
  sectionTitle: {
    flexShrink: 1,
    color: COLOR.textMuted,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  loadingText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
