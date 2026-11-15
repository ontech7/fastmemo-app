import AddNoteOverlayButton from "@/components/buttons/AddNoteOverlayButton";
import DeleteNotesButton from "@/components/buttons/DeleteNotesButton";
import NoteFiltersButton from "@/components/buttons/NoteFiltersButton";
import NoteCard from "@/components/cards/NoteCard";
import NoteContextMenu from "@/components/cards/NoteContextMenu";
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
import { useLaunchAction } from "@/hooks/useLaunchAction";
import { useNoteSearch } from "@/hooks/useNoteSearch";
import { useRouter } from "@/hooks/useRouter";
import { useOpenNote } from "@/hooks/useOpenNote";
import { useSecret } from "@/hooks/useSecret";
import { useReminderSyncQuestion } from "@/hooks/useReminderAsk";
import { useVaultPrompt } from "@/hooks/useVaultPrompt";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { setListHost } from "@/libs/desktopList";
import { keepOnScreen, menuTargets, rangeBetween, selectionAfterTrash } from "@/libs/listCursor";
import { addTrail } from "@/libs/diagnostics";
import Haptics from "@/libs/haptics";
import { type AppStore as HistoryStore, startHistory } from "@/libs/history";
import { startReminders } from "@/libs/reminders";
import { startWidget } from "@/libs/widget";
import type { SearchHit } from "@/libs/search/search";
import type { TagCount } from "@/libs/search/tags";
import { windowReady } from "@/libs/windowReady";
import { setVaultPromptNeeded } from "@/libs/vaultPrompt";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import {
  deleteNote,
  getAllNotesShown,
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
import type { Note, RootState } from "@/types";
import { notesLoaded } from "@/slicers/store";
import { duplicateNote } from "@/slicers/thunks/duplicateNote";
import type { AppDispatch } from "@/slicers/store";
import { toast } from "@/utils/toast";
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
import type { Store, UnknownAction } from "@reduxjs/toolkit";

/** What the home's list holds: notes, and while searching the groups' headings and the tags. */
type HomeRow =
  | { kind: "note"; note: Note; hit?: SearchHit }
  | { kind: "header"; id: string; title: string; count?: number }
  | { kind: "tag"; tag: TagCount };

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
  // What a link, a shortcut, a widget or a notification asked for (spec D.1): carried out here, with the home in front.
  useLaunchAction();
  const vaultUnlocked = useVaultUnlocked();
  // Gate the vault prompt until the version/changelog check has settled, so it
  // never overlaps the changelog screen that opens on a version bump.
  const [changelogChecked, setChangelogChecked] = useState(false);

  const store = useStore();

  // After the first draw: the versions of a note deleted for good go with it, and the history is swept once (spec B.9).
  useEffect(() => startHistory(store as unknown as HistoryStore, notesLoaded), [store]);
  // After the first draw too: the phone's reminders (spec D.5); nothing on the web and the desktop.
  useEffect(() => startReminders(store as Store<RootState>), [store]);
  useEffect(() => startWidget(store as Store<RootState>), [store]);
  const reminderQuestion = useReminderSyncQuestion();

  const currentCategory = useSelector(getCurrentCategory);
  const showHidden = useSelector(selectorShowHidden);
  // Keep the memoized selector instance stable across renders — building it inline
  // on every render gives reselect an empty cache each time, so `notes` would be a
  // fresh array on every render and rebuild the whole list (jank while typing).
  const selectNotes = useMemo(() => getNotesFilteredPerCategory(currentCategory, showHidden), [currentCategory, showHidden]);
  const notes = useSelector(selectNotes);
  const allNotes = useSelector(getAllNotesShown);

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

  // What was picked; `selectedNotes` (below) is the part of it on screen.
  const [pickedNotes, setSelectedNotes] = useState<string[]>([]);

  const [showDeleteNotesDialog, setShowDeleteNotesDialog] = useState(false);
  // Desktop: the note Delete asks about ("id|locked").
  const [trashOne, setTrashOne] = useState<string | null>(null);

  const { unlockWithSecret } = useSecret();
  const openNote = useOpenNote();

  // `ids` are "id|locked", as the selection holds them: the selection, or the one note the desktop's Delete marked.
  // `selection` is the selection on screen when it was asked.
  const temporaryDeleteSelectedNotesFromItems = (ids: string[], selection: string[]) => {
    const deleteNotes = () => {
      dispatch(temporaryDeleteSelectedNotes(ids));
      webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        extra: "multiple",
        ids: ids.map((noteId: string) => noteId.split("|")[0]),
      });
      // One note trashed from outside the selection leaves it as it is.
      const after = selectionAfterTrash(selection, ids);
      setSelectedNotes(after.selected);
      if (after.endMode) setIsDeleteMode(false);
    };

    if (ids.some((id: string) => id.split("|")[1] === "true")) {
      unlockWithSecret(deleteNotes);
    } else {
      deleteNotes();
    }
  };

  // The selection bar's flags, on "id|locked" ids: the selection, or one note from the desktop's right-click menu.
  const toggleNotesFlag = (flag: NoteFlag, ids: string[], after: () => void) => {
    const { action, property } = FLAG_ACTIONS[flag];
    const run = () => {
      dispatch(action(ids));
      webhook(webhook_updateNote, {
        action: "note/updateNote",
        extra: "multiple",
        ids: ids.map((noteId: string) => noteId.split("|")[0]),
        property,
      });
      after();
    };
    // Protect asks the secret code, as it does from the note's menu.
    if (flag === "protect") unlockWithSecret(run);
    else run();
  };
  const endSelection = () => {
    setSelectedNotes([]);
    setIsDeleteMode(false);
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

  // Desktop (spec C.1): while the home has the focus, the keyboard's list is the notes on screen. The list is handed over
  // when the home gains the focus and kept up to date while it has it, never dropped in between (dropping it is how the
  // list knows the home went away and came back).
  const listRef = useRef<FlashListRef<HomeRow>>(null);
  const noteIds = useMemo(() => rows.flatMap((row) => (row.kind === "note" ? [row.note.id] : [])), [rows]);
  // The selection is what was picked among the notes on screen: the bar never acts on a note a search hides (it is
  // selected again when the search lets it back).
  const selectedNotes = useMemo(() => keepOnScreen(pickedNotes, noteIds), [pickedNotes, noteIds]);
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

  // Desktop (spec C.2): Ctrl/Cmd + click toggles a card (starting select mode), Shift + click adds the cards from the last
  // one clicked or toggled. A plain click only moves that anchor.
  const clickAnchorRef = useRef<string | null>(null);
  const noteIdsRef = useRef(noteIds);
  const rowsRef = useRef(rows);
  useEffect(() => {
    noteIdsRef.current = noteIds;
    rowsRef.current = rows;
  }, [noteIds, rows]);
  const onDesktopClick = useCallback((note: Note, intent: "toggle" | "range" | null) => {
    const anchor = clickAnchorRef.current;
    clickAnchorRef.current = note.id;
    if (intent === null) return false;
    const locked = new Map(
      rowsRef.current.flatMap((row) => (row.kind === "note" ? [[row.note.id, row.note.locked] as const] : []))
    );
    const ids = intent === "toggle" ? [note.id] : rangeBetween(noteIdsRef.current, anchor, note.id);
    const keys = ids.map((id) => `${id}|${locked.get(id)}`);
    setSelectedNotes((prev) => {
      if (intent === "range") return [...prev, ...keys.filter((key) => !prev.includes(key))];
      return prev.includes(keys[0]) ? prev.filter((key) => key !== keys[0]) : [...prev, keys[0]];
    });
    setIsDeleteMode(true);
    return true;
  }, []);

  // Desktop (spec C.2): a note's menu at the pointer.
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null);
  const openMenu = useCallback((note: Note, at: { x: number; y: number }) => setMenu({ id: note.id, at }), []);
  const menuRow = menu ? rows.find((row) => row.kind === "note" && row.note.id === menu.id) : undefined;
  const menuNote = menuRow?.kind === "note" ? menuRow.note : null;
  const menuKey = menuNote ? `${menuNote.id}|${menuNote.locked}` : "";
  // A right click on a selected note acts on the selection; on any other note, on that note alone.
  const { ids: menuIds, onSelection: menuOnSelection } = menuTargets(selectedNotes, menuNote ? menuKey : "");
  const menuAfter = menuOnSelection ? endSelection : () => {};

  // Open: what a click on the card does.
  const openFromMenu = () => {
    if (!menuNote) return;
    openNote(menuNote.id, menuNote.locked, menuRow?.kind === "note" ? menuRow.hit?.line : undefined);
  };
  const duplicateFromMenu = async () => {
    if (!menuNote) return;
    try {
      const copyId = await (dispatch as AppDispatch)(duplicateNote(menuNote.id)).unwrap();
      toast(copyId ? t("note.duplicated") : t("ai.editor.no_content"));
    } catch {
      toast(t("note.duplicate_failed"));
    }
  };
  // The note's own screen for it; from the home, saving comes back here (no pass: the note wasn't open, LL-085).
  const changeCategoryFromMenu = () => {
    if (menuNote) router.push({ pathname: "/categories/change", params: { noteId: menuNote.id, from: "home" } });
  };
  const trashFromMenu = () => {
    if (menuOnSelection) setShowDeleteNotesDialog(true);
    else setTrashOne(menuKey);
  };

  // Stable across unrelated re-renders (focus changes, quick-note bar height, ...), so FlashList
  // only re-renders its cells when the selection or delete mode actually change (LL-019).
  const renderRow = useCallback(
    ({ item, index }: { item: HomeRow; index: number }) => {
      if (item.kind === "header") {
        return (
          <View style={styles.sectionHeader} accessibilityRole="header">
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
          onDesktopClick={onDesktopClick}
          openMenu={openMenu}
          // The tour's last step points at the first note.
          tourTarget={tourStep === "explore" && index === 0 ? "firstNote" : undefined}
        />
      );
    },
    [selectedNotes, selectNote, isDeleteMode, toggleDeleteMode, tourStep, searchTag, onDesktopClick, openMenu]
  );
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
      {reminderQuestion}
      <ConfirmOrCancelDialog
        open={showDeleteNotesDialog}
        destructive
        description={t("popup.delete_notes")}
        onCancel={() => {
          toggleDeleteMode();
          setShowDeleteNotesDialog(false);
        }}
        onConfirm={() => {
          temporaryDeleteSelectedNotesFromItems(selectedNotes, selectedNotes);
          setShowDeleteNotesDialog(false);
        }}
      />

      <ConfirmOrCancelDialog
        open={trashOne !== null}
        destructive
        description={t("popup.delete_note")}
        onCancel={() => setTrashOne(null)}
        onConfirm={() => {
          if (trashOne) temporaryDeleteSelectedNotesFromItems([trashOne], selectedNotes);
          setTrashOne(null);
        }}
      />

      <NoteContextMenu
        note={menuNote}
        at={menu?.at ?? null}
        selectionCount={menuOnSelection ? selectedNotes.length : 1}
        onOpen={openFromMenu}
        onToggle={(flag) => toggleNotesFlag(flag, menuIds, menuAfter)}
        onDuplicate={duplicateFromMenu}
        onChangeCategory={changeCategoryFromMenu}
        onTrash={trashFromMenu}
        onClose={() => setMenu(null)}
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
                onImportant={() => toggleNotesFlag("important", selectedNotes, endSelection)}
                onProtect={() => toggleNotesFlag("protect", selectedNotes, endSelection)}
                onHide={() => toggleNotesFlag("hide", selectedNotes, endSelection)}
                onReadOnly={() => toggleNotesFlag("readOnly", selectedNotes, endSelection)}
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

type NoteFlag = "important" | "protect" | "readOnly" | "hide";

/** Each flag's reducer and the property its webhook names. */
const FLAG_ACTIONS: Record<NoteFlag, { action: (ids: string[]) => UnknownAction; property: string }> = {
  important: { action: toggleImportantNotes, property: "important" },
  protect: { action: toggleProtectedNotes, property: "locked" },
  readOnly: { action: toggleReadOnlyNotes, property: "readOnly" },
  hide: { action: toggleHiddenNotes, property: "hidden" },
};

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
