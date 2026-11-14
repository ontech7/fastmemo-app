import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import VersionBand, { type VersionPreview } from "@/components/notes/VersionBand";
import EditorTourTip from "@/components/notes/EditorTourTip";
import CodeDraggableTab from "@/components/notes/CodeDraggableTab";
import CodeEditorWebView, { type CodeEditorWebViewRef } from "@/components/notes/CodeEditorWebView";
import CodeLanguagePickerModal from "@/components/notes/CodeLanguagePickerModal";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import IconChip from "@/components/ui/IconChip";
import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { createCodeFindTarget } from "@/libs/findTarget";
import { type FindOnOpen, takeFindOnOpen } from "@/libs/search/findOnOpen";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { inferLanguageFromTitle, LANGUAGE_LABELS } from "@/constants/code-languages";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, MONOSPACE_FONT, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName } from "@/libs/ai";
import { registerPendingFlush } from "@/libs/registry";
import { selectorAIAssistant, selectorWebhook_addCodeNote } from "@/slicers/settingsSlice";
import type { CodeNote, CodeTab } from "@/types";
import { isStringEmpty } from "@/utils/string";

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MagnifyingGlassIcon from "react-native-heroicons/outline/MagnifyingGlassIcon";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

export const MAX_TABS = 6;
export const TAB_WIDTH_ESTIMATE = 110;

interface Props {
  initialNote: CodeNote;
  /** A kept version on screen (spec B.9): read only, no menu, nothing reaches the store. */
  preview?: VersionPreview;
}

const isCodeNoteEmpty = (n: CodeNote) => {
  const noTitle = isStringEmpty(n.title);
  const noCode = n.tabs.every((tab) => isStringEmpty(tab.code));
  return noTitle && noCode;
};

/** The id of the tab on screen in `n`: the one shown, or the first if it no longer exists. */
const shownTabIn = (n: CodeNote, shownId: string) => (n.tabs.some((tab) => tab.id === shownId) ? shownId : n.tabs[0]?.id || "");

/** The find bar's target for the code page in `editorRef`. */
function codeFindTarget(editorRef: React.RefObject<CodeEditorWebViewRef | null>) {
  return createCodeFindTarget((request) => editorRef.current?.find(request));
}

export default function NoteCodeEditor({ initialNote, preview }: Props) {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);

  const tabScrollRef = useRef<ScrollViewInstance>(null);
  const editorRef = useRef<CodeEditorWebViewRef>(null);

  // The CodeMirror WebView mounts immediately (never gated behind an idle timer)
  // so it starts loading at once; a placeholder of the raw code stays on top of
  // it until it reports it has painted (`onReady`), so the user never sees the
  // empty editor surface while the WebView spins up.
  const [editorPainted, setEditorPainted] = useState(false);

  // Only a brand-new note autofocuses the editor content (not the tab title), so
  // opening an existing note just lets the user read without popping the keyboard.
  const autofocus = useAutofocusNewNote(initialNote);
  const transitionDone = useScreenTransitionEnd();
  const didFocusRef = useRef(false);

  // Focus once the editor has painted AND the screen transition has settled.
  useEffect(() => {
    if (didFocusRef.current) return;
    if (!autofocus) return;
    if (!editorPainted || !transitionDone) return;
    didFocusRef.current = true;
    editorRef.current?.focus();
  }, [editorPainted, transitionDone, autofocus]);

  // Safety net: never leave the loading cover up forever if the WebView's ready
  // signal somehow never arrives.
  useEffect(() => {
    const id = setTimeout(() => setEditorPainted(true), 3000);
    return () => clearTimeout(id);
  }, []);

  const memoInitialNote = useMemo<CodeNote>(
    () => ({
      ...initialNote,
      type: initialNote.type || "code",
      tabs: initialNote.tabs?.length > 0 ? initialNote.tabs : [{ id: uuid(), title: "", code: "", language: "javascript" }],
      activeTabId: initialNote.activeTabId || initialNote.tabs?.[0]?.id || "",
    }),
    [initialNote]
  );
  const buildPayloadExtras = useCallback((n: CodeNote) => ({ tabs: n.tabs, activeTabId: n.activeTabId }), []);

  // The tab on screen is this device's view, not part of the note: looking at another tab changes nothing stored. A
  // real change writes it as `activeTabId` together with the change (the note reopens there, the webhook sends it).
  const [shownTabId, setShownTabIdState] = useState(memoInitialNote.activeTabId);
  const shownTabIdRef = useRef(shownTabId);
  const setShownTabId = useCallback((tabId: string) => {
    shownTabIdRef.current = tabId;
    setShownTabIdState(tabId);
  }, []);

  // Changed on another device while open here: this device stays on its tab if it still exists, and the WebView editor,
  // which holds its own copy of the code, loads the new one (the same tab keeps the cursor; another is a new document).
  const onRemoteChange = useCallback(
    (remote: CodeNote) => {
      const shown = remote.tabs.find((tab) => tab.id === shownTabIdRef.current);
      const tab = shown ?? remote.tabs[0];
      if (!shown && tab) setShownTabId(tab.id);
      editorRef.current?.setCode(tab?.code || "", { remote: !!shown, tag: tab?.id });
      editorRef.current?.setLanguage(tab?.language || "plaintext");
    },
    [setShownTabId]
  );

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle, keepVersion } = useNoteEditor<CodeNote>(
    {
      initialNote: memoInitialNote,
      defaultType: "code",
      addWebhookSelector: selectorWebhook_addCodeNote,
      addAction: "note/addCodeNote",
      preview: !!preview,
      isEmpty: isCodeNoteEmpty,
      buildPayloadExtras,
      getTitleSource: (n) =>
        n.tabs
          .map((tab) => tab.code)
          .filter(Boolean)
          .join(" "),
      onRemoteChange,
    }
  );

  // The page sends its text when typing pauses: the app going to the background or the tab closing asks for it now. On
  // the web it is handed over before flush() returns and committed here; on a phone it arrives while the app isn't
  // active, and useNoteEditor writes it at once.
  useEffect(
    () =>
      registerPendingFlush(() => {
        editorRef.current?.flush();
        flushNote();
      }),
    [flushNote]
  );
  // Leaving the note asks for it too: the screen stays mounted through its transition, long enough for the answer, which
  // the editor commits when it goes away.
  useFocusEffect(useCallback(() => () => editorRef.current?.flush(), []));

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [editingTabTitle, setEditingTabTitle] = useState<string | null>(null);

  // The AI button is the only floating bottom action for now; the divider and
  // the editor's reserved bottom space follow whether it's actually shown.
  const showAiActions = aiSettings.enabled && aiSettings.modelDownloaded && !note.readOnly;

  const activeTab = useMemo(() => note.tabs.find((tab) => tab.id === shownTabId) || note.tabs[0], [note.tabs, shownTabId]);
  const activeTabIndex = useMemo(() => note.tabs.indexOf(activeTab), [note.tabs, activeTab]);

  const setTitle = useCallback(
    (v: string) =>
      updateNoteAsync((current) => ({ ...current, title: v, activeTabId: shownTabIn(current, shownTabIdRef.current) })),
    [updateNoteAsync]
  );

  const addTab = useCallback(() => {
    const newTab: CodeTab = { id: uuid(), title: "", code: "", language: "javascript" };
    let added = false;
    updateNoteAsync((current) => {
      if (current.tabs.length >= MAX_TABS) return current;
      added = true;
      return { ...current, tabs: [...current.tabs, newTab], activeTabId: newTab.id };
    });
    if (!added) return;
    setShownTabId(newTab.id);
    editorRef.current?.setCode("", { tag: newTab.id });
    editorRef.current?.setLanguage("javascript");
    setTimeout(() => tabScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [updateNoteAsync, setShownTabId]);

  const removeTab = useCallback(
    (tabId: string) => {
      let nextShown: CodeTab | null = null;
      updateNoteAsync((current) => {
        if (current.tabs.length <= 1) return current;
        const filtered = current.tabs.filter((tab) => tab.id !== tabId);
        const wasShown = shownTabIn(current, shownTabIdRef.current) === tabId;
        if (wasShown) nextShown = filtered[0];
        return {
          ...current,
          tabs: filtered,
          activeTabId: wasShown ? filtered[0].id : shownTabIn(current, shownTabIdRef.current),
        };
      });
      const shown = nextShown as CodeTab | null;
      if (!shown) return;
      setShownTabId(shown.id);
      editorRef.current?.setCode(shown.code || "", { tag: shown.id });
      editorRef.current?.setLanguage(shown.language || "plaintext");
    },
    [updateNoteAsync, setShownTabId]
  );

  // Only what is on screen changes: nothing is stored, dated or uploaded.
  const setActiveTab = useCallback(
    (tabId: string) => {
      if (shownTabIdRef.current === tabId) return;
      const target = note.tabs.find((tab) => tab.id === tabId);
      if (!target) return;
      setShownTabId(tabId);
      editorRef.current?.setCode(target.code || "", { tag: tabId });
      editorRef.current?.setLanguage(target.language || "plaintext");
    },
    [note.tabs, setShownTabId]
  );

  // Find and replace (spec B.8): the text note's bar, searching the tab on screen through the code page.
  const [showFindReplace, setShowFindReplace] = useState(false);
  // Opened from a search result: its word, shown in the find bar once the page is ready, on the result's tab.
  const [findWord, setFindWord] = useState<string | undefined>(undefined);
  const pendingFindRef = useRef<FindOnOpen | null>(null);
  // The target reads the editor's ref only when the bar searches, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [findTarget] = useState(() => codeFindTarget(editorRef));
  useEffect(() => {
    pendingFindRef.current = takeFindOnOpen(initialNote.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The page is up: the result's tab is shown as a tap shows it, then the bar opens on its word.
  const onEditorReady = useCallback(() => {
    setEditorPainted(true);
    const found = pendingFindRef.current;
    pendingFindRef.current = null;
    if (!found) return;
    if (found.tabId) setActiveTab(found.tabId);
    setFindWord(found.word);
    setShowFindReplace(true);
  }, [setActiveTab]);

  // The editor's text goes to the tab it was typed in (`tabId`: the one on screen, or one a tab switch just left, whose
  // last text the page sends at the switch); a tab removed meanwhile takes nothing.
  const updateTabCode = useCallback(
    (code: string, tabId?: string) =>
      updateNoteAsync((current) => {
        const shown = shownTabIn(current, shownTabIdRef.current);
        const target = tabId ?? shown;
        if (!current.tabs.some((tab) => tab.id === target)) return current;
        return {
          ...current,
          tabs: current.tabs.map((tab) => (tab.id === target ? { ...tab, code } : tab)),
          activeTabId: shown,
        };
      }),
    [updateNoteAsync]
  );

  const updateTabTitle = useCallback(
    (tabId: string, title: string) => {
      const inferred = inferLanguageFromTitle(title);
      updateNoteAsync((current) => ({
        ...current,
        tabs: current.tabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          return inferred ? { ...tab, title, language: inferred } : { ...tab, title };
        }),
        activeTabId: shownTabIn(current, shownTabIdRef.current),
      }));
    },
    [updateNoteAsync]
  );

  const updateTabLanguage = useCallback(
    (language: string) => {
      updateNoteAsync((current) => {
        const shown = shownTabIn(current, shownTabIdRef.current);
        return {
          ...current,
          tabs: current.tabs.map((tab) => (tab.id === shown ? { ...tab, language } : tab)),
          activeTabId: shown,
        };
      });
      setShowLanguagePicker(false);
    },
    [updateNoteAsync]
  );

  const handleReorder = useCallback(
    (fromIndex: number, translationX: number) => {
      const positions = Math.round(translationX / TAB_WIDTH_ESTIMATE);
      if (positions === 0) return;
      updateNoteAsync((current) => {
        const toIndex = Math.max(0, Math.min(current.tabs.length - 1, fromIndex + positions));
        if (fromIndex === toIndex) return current;
        const newTabs = [...current.tabs];
        const [moved] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, moved);
        return { ...current, tabs: newTabs, activeTabId: shownTabIn(current, shownTabIdRef.current) };
      });
    },
    [updateNoteAsync]
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Static full-screen backdrop kept OUTSIDE the KeyboardAvoidingView: when
          the keyboard animates, `behavior:"height"` resizes the KAV subtree every
          frame, and a full-screen SVG gradient re-rasterizing each frame is what
          dropped the keyboard open to ~10fps. */}
      <AppBackground style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <View>
            <View style={styles.header}>
              <BackButton chip tourTarget="back" callback={updateNoteWebhook} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  style={styles.titleInput}
                  onChangeText={setTitle}
                  value={note.title}
                  editable={!note.readOnly}
                  cursorColor={COLOR.softWhite}
                  placeholder={autoTitle || t("note.title_placeholder")}
                  placeholderTextColor={COLOR.textMuted}
                  maxLength={96}
                />
              </View>
              <TouchableOpacity
                style={styles.searchToggle}
                onPress={() => {
                  setShowFindReplace((prev) => !prev);
                  setFindWord(undefined);
                }}
                testID={showFindReplace ? undefined : SHORTCUT_TARGET.find}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.search_in_note")}
                aria-expanded={showFindReplace}
              >
                <IconChip>
                  <MagnifyingGlassIcon size={20} color={showFindReplace ? COLOR.accentSoft : COLOR.softWhite} />
                </IconChip>
              </TouchableOpacity>
              {preview ? (
                <View style={styles.menuSpacer} />
              ) : (
                <NoteSettingsButton note={note} setNote={setNoteAsync} flushNote={flushNote} />
              )}
            </View>
            {preview ? <VersionBand preview={preview} /> : <NotePresenceBanner noteId={note.id} />}
            <FindReplaceBar
              visible={showFindReplace}
              onClose={() => {
                setShowFindReplace(false);
                setFindWord(undefined);
              }}
              target={findTarget}
              onBeforeReplaceAll={() => keepVersion("replace")}
              readOnly={note.readOnly}
              initialQuery={findWord}
              scope={activeTab?.id}
              style={styles.findBar}
            />
          </View>

          <View style={styles.tabBarContainer}>
            <GestureHandlerRootView style={{ flexDirection: "row" }}>
              <ScrollView
                ref={tabScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabBarContent}
              >
                {note.tabs.map((tab, index) => (
                  <CodeDraggableTab
                    key={tab.id}
                    tab={tab}
                    index={index}
                    isActive={tab.id === activeTab?.id}
                    isEditing={editingTabTitle === tab.id}
                    readOnly={note.readOnly}
                    tabCount={note.tabs.length}
                    onSelect={() => setActiveTab(tab.id)}
                    onEditTitle={() => setEditingTabTitle(tab.id)}
                    onStopEditTitle={() => setEditingTabTitle(null)}
                    onTitleChange={(text) => updateTabTitle(tab.id, text)}
                    onDelete={() => removeTab(tab.id)}
                    onReorder={handleReorder}
                    t={t}
                  />
                ))}
                {note.tabs.length < MAX_TABS && !note.readOnly && (
                  <TouchableOpacity
                    style={styles.addTabButton}
                    onPress={addTab}
                    accessibilityRole="button"
                    accessibilityLabel={t("code.add_tab")}
                    activeOpacity={0.7}
                  >
                    <PlusIcon size={16} color={COLOR.textSecondary} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </GestureHandlerRootView>
          </View>

          <View style={styles.languageBar}>
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => !note.readOnly && setShowLanguagePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.languageLabel}>{LANGUAGE_LABELS[activeTab?.language] || activeTab?.language}</Text>
            </TouchableOpacity>
            <Text style={styles.tabCounter}>
              {activeTabIndex + 1}/{note.tabs.length}
            </Text>
          </View>

          <View style={[styles.editorContainer, showAiActions && styles.editorContainerWithDock]}>
            <CodeEditorWebView
              ref={editorRef}
              initialCode={activeTab?.code || ""}
              language={activeTab?.language || "plaintext"}
              readOnly={note.readOnly}
              onChange={updateTabCode}
              initialTag={activeTab?.id}
              onReady={onEditorReady}
              onFound={findTarget.handle}
            />

            {/* Raw-code placeholder kept over the WebView until CodeMirror has
                painted, so the user sees the code immediately instead of the empty
                editor surface while the WebView loads. */}
            {!editorPainted && (
              <View style={styles.codeLoadingCover} pointerEvents="none">
                <Text style={styles.codePlaceholder}>{activeTab?.code || ""}</Text>
              </View>
            )}
          </View>

          {showAiActions && (
            <EditorActionDock>
              <View style={dockGroupStyle}>
                <AIEditorActions
                  noteType="code"
                  getContent={() => activeTab?.code || ""}
                  noteTitle={note.title}
                  categoryName={note.category.name}
                  onTitleGenerated={(title) => updateNoteAsync((current) => ({ ...current, title }))}
                  onCategorySuggested={(name) => {
                    const cat = findCategoryByName(name);
                    if (cat) updateNoteAsync((current) => ({ ...current, category: cat }));
                  }}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />
              </View>
            </EditorActionDock>
          )}

          <CodeLanguagePickerModal
            visible={showLanguagePicker}
            selectedLanguage={activeTab?.language || "plaintext"}
            onSelect={updateTabLanguage}
            onClose={() => setShowLanguagePicker(false)}
            title={t("code.language")}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>

      {!preview && <EditorTourTip />}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  // where the note menu sits, so the title stays centred while a version is shown
  menuSpacer: {
    width: 42,
  },
  searchToggle: {
    marginRight: PADDING_MARGIN.sm,
  },
  findBar: {
    marginTop: PADDING_MARGIN.md,
  },
  container: {
    height: SIZE.full,
    paddingVertical: PADDING_MARGIN.lg,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  titleInput: {
    textAlign: "center",
    // Android misplaces the caret of an empty centered TextInput (drifts to the
    // bottom/right until typing starts); these two keep it centered.
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginHorizontal: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    borderRadius: BORDER.normal,
  },
  tabBarContainer: {
    marginTop: PADDING_MARGIN.lg,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  tabBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surfaceMuted,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    maxWidth: 160,
  },
  tabActive: {
    backgroundColor: "#1e1e1e",
  },
  tabTitle: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.textSecondary,
    maxWidth: 100,
  },
  tabTitleActive: {
    color: COLOR.softWhite,
  },
  tabTitleInput: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    padding: 0,
    minWidth: 60,
  },
  tabDeleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    padding: 2,
  },
  addTabButton: {
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surfaceMuted,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    justifyContent: "center",
    alignItems: "center",
  },
  languageBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.sm - 2,
    backgroundColor: "#1e1e1e",
    marginHorizontal: PADDING_MARGIN.lg,
    borderTopWidth: 1,
    borderTopColor: "#2d2d2d",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: "#2d2d2d",
    borderRadius: BORDER.small,
  },
  languageLabel: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.codeMint,
  },
  tabCounter: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.textSecondary,
  },
  editorContainer: {
    flex: 1,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: "#282c34",
    borderBottomLeftRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
    overflow: "hidden",
  },
  // A little breathing room before the action dock (only applied when it's shown,
  // so without the dock the editor still fills down to the safe area).
  editorContainerWithDock: {
    marginBottom: PADDING_MARGIN.lg,
  },
  codePlaceholder: {
    color: COLOR.textPrimary,
    fontFamily: MONOSPACE_FONT,
    fontSize: FONTSIZE.small,
    padding: PADDING_MARGIN.md,
  },
  // Opaque cover (matches the editor surface) shown over the WebView until
  // CodeMirror reports it has painted, hiding the empty-editor flash on load.
  codeLoadingCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#282c34",
  },
});
