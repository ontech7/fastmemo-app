import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import CodeDraggableTab from "@/components/notes/CodeDraggableTab";
import CodeEditorWebView, { type CodeEditorWebViewRef } from "@/components/notes/CodeEditorWebView";
import CodeLanguagePickerModal from "@/components/notes/CodeLanguagePickerModal";
import QuickActionsDivider from "@/components/notes/QuickActionsDivider";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { inferLanguageFromTitle, LANGUAGE_LABELS } from "@/constants/code-languages";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, MONOSPACE_FONT, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName } from "@/libs/ai";
import { selectorAIAssistant, selectorWebhook_addCodeNote } from "@/slicers/settingsSlice";
import type { CodeNote, CodeTab } from "@/types";
import { isStringEmpty } from "@/utils/string";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PlusIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

export const MAX_TABS = 6;
export const TAB_WIDTH_ESTIMATE = 110;

interface Props {
  initialNote: CodeNote;
}

const isCodeNoteEmpty = (n: CodeNote) => {
  const noTitle = isStringEmpty(n.title);
  const noCode = n.tabs.every((tab) => isStringEmpty(tab.code));
  return noTitle && noCode;
};

export default function NoteCodeEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);

  const tabScrollRef = useRef<ScrollView>(null);
  const editorRef = useRef<CodeEditorWebViewRef>(null);

  // The CodeMirror WebView mounts immediately (never gated behind an idle timer)
  // so it starts loading at once; a placeholder of the raw code stays on top of
  // it until it reports it has painted (`onReady`), so the user never sees the
  // empty editor surface while the WebView spins up.
  const [editorPainted, setEditorPainted] = useState(false);

  // Only a brand-new note autofocuses the editor content (not the tab title), so
  // opening an existing note just lets the user read without popping the keyboard.
  const isNewNote = useMemo(() => initialNote.createdAt === initialNote.updatedAt, [initialNote]);
  const transitionDone = useScreenTransitionEnd();
  const didFocusRef = useRef(false);

  // Focus once the editor has painted AND the screen transition has settled.
  useEffect(() => {
    if (didFocusRef.current) return;
    if (!isNewNote || initialNote.readOnly) return;
    if (!editorPainted || !transitionDone) return;
    didFocusRef.current = true;
    editorRef.current?.focus();
  }, [editorPainted, transitionDone, isNewNote, initialNote.readOnly]);

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

  const { note, setNoteAsync, updateNoteWebhook, autoTitle } = useNoteEditor<CodeNote>({
    initialNote: memoInitialNote,
    defaultType: "code",
    addWebhookSelector: selectorWebhook_addCodeNote,
    addAction: "note/addCodeNote",
    isEmpty: isCodeNoteEmpty,
    buildPayloadExtras,
    getTitleSource: (n) =>
      n.tabs
        .map((tab) => tab.code)
        .filter(Boolean)
        .join(" "),
  });

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [editingTabTitle, setEditingTabTitle] = useState<string | null>(null);

  // The AI button is the only floating bottom action for now; the divider and
  // the editor's reserved bottom space follow whether it's actually shown.
  const showAiActions = aiSettings.enabled && aiSettings.modelDownloaded && !note.readOnly;

  const activeTab = useMemo(
    () => note.tabs.find((tab) => tab.id === note.activeTabId) || note.tabs[0],
    [note.tabs, note.activeTabId]
  );
  const activeTabIndex = useMemo(
    () => note.tabs.findIndex((tab) => tab.id === note.activeTabId),
    [note.tabs, note.activeTabId]
  );

  const setTitle = useCallback((v: string) => setNoteAsync({ ...note, title: v }), [note, setNoteAsync]);

  const addTab = useCallback(() => {
    if (note.tabs.length >= MAX_TABS) return;
    const newTab: CodeTab = { id: uuid(), title: "", code: "", language: "javascript" };
    setNoteAsync({ ...note, tabs: [...note.tabs, newTab], activeTabId: newTab.id });
    editorRef.current?.setCode("");
    editorRef.current?.setLanguage("javascript");
    setTimeout(() => tabScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [note, setNoteAsync]);

  const removeTab = useCallback(
    (tabId: string) => {
      if (note.tabs.length <= 1) return;
      const filtered = note.tabs.filter((tab) => tab.id !== tabId);
      const newActiveId = note.activeTabId === tabId ? filtered[0].id : note.activeTabId;
      const newActive = filtered.find((tab) => tab.id === newActiveId);
      setNoteAsync({ ...note, tabs: filtered, activeTabId: newActiveId });
      if (note.activeTabId === tabId) {
        editorRef.current?.setCode(newActive?.code || "");
        editorRef.current?.setLanguage(newActive?.language || "plaintext");
      }
    },
    [note, setNoteAsync]
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      if (note.activeTabId === tabId) return;
      const target = note.tabs.find((tab) => tab.id === tabId);
      setNoteAsync({ ...note, activeTabId: tabId });
      editorRef.current?.setCode(target?.code || "");
      editorRef.current?.setLanguage(target?.language || "plaintext");
    },
    [note, setNoteAsync]
  );

  const updateTabCode = useCallback(
    (code: string) => {
      const updatedTabs = note.tabs.map((tab) => (tab.id === note.activeTabId ? { ...tab, code } : tab));
      setNoteAsync({ ...note, tabs: updatedTabs });
    },
    [note, setNoteAsync]
  );

  const updateTabTitle = useCallback(
    (tabId: string, title: string) => {
      const inferred = inferLanguageFromTitle(title);
      const updatedTabs = note.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        return inferred ? { ...tab, title, language: inferred } : { ...tab, title };
      });
      setNoteAsync({ ...note, tabs: updatedTabs });
    },
    [note, setNoteAsync]
  );

  const updateTabLanguage = useCallback(
    (language: string) => {
      const updatedTabs = note.tabs.map((tab) => (tab.id === note.activeTabId ? { ...tab, language } : tab));
      setNoteAsync({ ...note, tabs: updatedTabs });
      setShowLanguagePicker(false);
    },
    [note, setNoteAsync]
  );

  const handleReorder = useCallback(
    (fromIndex: number, translationX: number) => {
      const positions = Math.round(translationX / TAB_WIDTH_ESTIMATE);
      if (positions === 0) return;
      const toIndex = Math.max(0, Math.min(note.tabs.length - 1, fromIndex + positions));
      if (fromIndex === toIndex) return;
      const newTabs = [...note.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      setNoteAsync({ ...note, tabs: newTabs });
    },
    [note, setNoteAsync]
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
              <BackButton chip callback={updateNoteWebhook} />
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
              <NoteSettingsButton note={note} setNote={setNoteAsync} />
            </View>
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
                    isActive={tab.id === note.activeTabId}
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
                  <TouchableOpacity style={styles.addTabButton} onPress={addTab} activeOpacity={0.7}>
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

          <View style={[styles.editorContainer, showAiActions && { marginBottom: 90 }]}>
            <CodeEditorWebView
              ref={editorRef}
              initialCode={activeTab?.code || ""}
              language={activeTab?.language || "plaintext"}
              readOnly={note.readOnly}
              onChange={updateTabCode}
              onReady={() => setEditorPainted(true)}
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

          {!note.readOnly && (
            <AIEditorActions
              noteType="code"
              getContent={() => activeTab?.code || ""}
              noteTitle={note.title}
              onTitleGenerated={(title) => setNoteAsync({ ...note, title })}
              onCategorySuggested={(name) => {
                const cat = findCategoryByName(name);
                if (cat) setNoteAsync({ ...note, category: cat });
              }}
              onCodeCommented={(commentedCode) => {
                const updatedTabs = note.tabs.map((tab) =>
                  tab.id === note.activeTabId ? { ...tab, code: commentedCode } : tab
                );
                setNoteAsync({ ...note, tabs: updatedTabs });
                editorRef.current?.setCode(commentedCode);
              }}
              style={{ bottom: 50 }}
              menuBottomOffset={120}
            />
          )}

          {showAiActions && <QuickActionsDivider bottom={110} />}

          <CodeLanguagePickerModal
            visible={showLanguagePicker}
            selectedLanguage={activeTab?.language || "plaintext"}
            onSelect={updateTabLanguage}
            onClose={() => setShowLanguagePicker(false)}
            title={t("code.language")}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
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
