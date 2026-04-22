import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import CodeDraggableTab from "@/components/notes/CodeDraggableTab";
import CodeEditorWebView, { type CodeEditorWebViewRef } from "@/components/notes/CodeEditorWebView";
import CodeLanguagePickerModal from "@/components/notes/CodeLanguagePickerModal";
import SafeAreaView from "@/components/SafeAreaView";
import { inferLanguageFromTitle, LANGUAGE_LABELS } from "@/constants/code-languages";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, MONOSPACE_FONT, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { findCategoryByName } from "@/libs/ai";
import { storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorAIAssistant,
  selectorWebhook_addCodeNote,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import type { CodeNote, CodeTab } from "@/types";
import { formatDateTime } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";

import { webhook } from "@/utils/webhook";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PlusIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView, KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

export const MAX_TABS = 6;
export const TAB_WIDTH_ESTIMATE = 110;

interface Props {
  initialNote: CodeNote;
}

export default function NoteCodeEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);

  const webhook_addCodeNote = useSelector(selectorWebhook_addCodeNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();

  const tabScrollRef = useRef<ScrollView>(null);
  const editorRef = useRef<CodeEditorWebViewRef>(null);

  const [note, setNote] = useState<CodeNote>({
    ...initialNote,
    type: initialNote.type || "code",
    tabs: initialNote.tabs?.length > 0 ? initialNote.tabs : [{ id: uuid(), title: "", code: "", language: "javascript" }],
    activeTabId: initialNote.activeTabId || initialNote.tabs?.[0]?.id || "",
  });
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [editingTabTitle, setEditingTabTitle] = useState<string | null>(null);

  const isNewlyCreated = note.createdAt === note.updatedAt;
  const activeTab = useMemo(
    () => note.tabs.find((tab) => tab.id === note.activeTabId) || note.tabs[0],
    [note.tabs, note.activeTabId]
  );
  const activeTabIndex = useMemo(
    () => note.tabs.findIndex((tab) => tab.id === note.activeTabId),
    [note.tabs, note.activeTabId]
  );

  useEffect(() => {
    if (!isNewlyCreated) return;
    webhook(webhook_addCodeNote, {
      action: "note/addCodeNote",
      id: note.id,
      type: "code",
      title: note.title,
      tabs: note.tabs,
      activeTabId: note.activeTabId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      important: note.important,
      readOnly: note.readOnly,
      hidden: note.hidden,
      locked: note.locked,
      category: { iconId: note.category.icon, name: note.category.name },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewlyCreated]);

  const updateNoteGlobal = useCallback(
    (currNote: CodeNote) => {
      const noTitle = isStringEmpty(currNote.title);
      const noCode = currNote.tabs.every((tab) => isStringEmpty(tab.code));
      if (noTitle && noCode) {
        dispatch(temporaryDeleteNote(currNote.id));
        dispatch(deleteNote(currNote.id));
        return;
      }
      dispatch(addNote({ ...currNote, type: currNote.type || "code", updatedAt: Date.now(), date: formatDateTime() }));
    },
    [dispatch]
  );

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
  }, [note.id]);

  useEffect(
    () => () => {
      dirtyRef.current = false;
    },
    []
  );

  const setNoteAsync = useCallback(
    (currNote: CodeNote) => {
      if (!dirtyRef.current) {
        storeDirtyNoteId(currNote.id);
        dirtyRef.current = true;
      }
      setNote(currNote);
      updateNoteGlobal(currNote);
    },
    [updateNoteGlobal]
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

  const updateNoteWebhook = useCallback(async () => {
    const noTitle = isStringEmpty(note.title);
    const noCode = note.tabs.every((tab) => isStringEmpty(tab.code));

    if (noTitle && noCode) {
      await webhook(webhook_temporaryDeleteNote, { action: "note/temporaryDeleteNote", id: note.id });
      await webhook(webhook_deleteNote, { action: "note/deleteNote", id: note.id });
    } else {
      await webhook(webhook_updateNote, {
        action: "note/updateNote",
        id: note.id,
        type: note.type || "code",
        title: note.title,
        tabs: note.tabs,
        activeTabId: note.activeTabId,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        important: note.important,
        readOnly: note.readOnly,
        hidden: note.hidden,
        locked: note.locked,
        category: { iconId: note.category.icon, name: note.category.name },
      });
    }
  }, [webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote, note]);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      KeyboardController.dismiss();
      Keyboard.dismiss();
      return false;
    });
    return () => handler.remove();
  }, [updateNoteWebhook]);

  useFocusEffect(
    useCallback(
      () => () => {
        KeyboardController.dismiss();
        Keyboard.dismiss();
      },
      []
    )
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View>
          <View style={styles.header}>
            <BackButton callback={updateNoteWebhook} />
            <View style={{ flexGrow: 1 }}>
              <TextInput
                style={styles.titleInput}
                onChangeText={setTitle}
                value={note.title}
                editable={!note.readOnly}
                cursorColor={COLOR.softWhite}
                placeholder={t("note.title_placeholder")}
                placeholderTextColor={COLOR.placeholder}
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
                  <PlusIcon size={16} color={COLOR.lightBlue} />
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

        <View style={[styles.editorContainer, aiSettings.enabled && { marginBottom: 100 }]}>
          <CodeEditorWebView
            ref={editorRef}
            initialCode={activeTab?.code || ""}
            language={activeTab?.language || "plaintext"}
            readOnly={note.readOnly}
            onChange={updateTabCode}
          />
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
              const updatedTabs = note.tabs.map((tab) => (tab.id === note.activeTabId ? { ...tab, code: commentedCode } : tab));
              setNoteAsync({ ...note, tabs: updatedTabs });
              editorRef.current?.setCode(commentedCode);
            }}
            style={{ bottom: 65 }}
            menuBottomOffset={120}
          />
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
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    height: SIZE.full,
    paddingVertical: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  titleInput: {
    textAlign: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
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
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    maxWidth: 160,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 2 },
  },
  tabActive: {
    backgroundColor: "#1e1e1e",
  },
  tabTitle: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
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
    backgroundColor: COLOR.blue,
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
    color: COLOR.lightBlue,
  },
  editorContainer: {
    flex: 1,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: "#282c34",
    borderBottomLeftRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
    overflow: "hidden",
  },
});
