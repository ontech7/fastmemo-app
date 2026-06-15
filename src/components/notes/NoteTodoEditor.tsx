import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PlusIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import uuid from "react-uuid";

import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import TodoModeMenuButton from "@/components/notes/TodoModeMenuButton";
import SafeAreaView from "@/components/SafeAreaView";
import TodoItem from "@/components/todo/TodoItem.native";
import AppBackground from "@/components/ui/AppBackground";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName } from "@/libs/ai";
import { selectorWebhook_addTodoNote } from "@/slicers/settingsSlice";
import { capitalize, isStringEmpty } from "@/utils/string";
import { voiceTextToLines } from "@/utils/voiceTranscript";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import type { TodoItem as TodoItemType, TodoNote } from "@/types";

interface Props {
  initialNote: TodoNote;
}

const isTodoNoteEmpty = (n: TodoNote) => {
  const no_title = isStringEmpty(n.title);
  const no_list_items = !n.list?.length || (n.list?.length == 1 && isStringEmpty(n.list?.[0].text));
  return no_title && no_list_items;
};

export default function NoteTodoEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const draggableListRef = useRef(null);

  const memoInitialNote = useMemo<TodoNote>(
    () => ({
      ...initialNote,
      type: initialNote.type || "todo",
      list: initialNote.list?.length > 0 ? initialNote.list : [{ id: uuid(), text: "", checked: false }],
    }),
    [initialNote]
  );
  const buildPayloadExtras = useCallback((n: TodoNote) => ({ list: n.list, mode: n.mode }), []);

  const { note, setNoteAsync, updateNoteWebhook, autoTitle } = useNoteEditor<TodoNote>({
    initialNote: memoInitialNote,
    defaultType: "todo",
    addWebhookSelector: selectorWebhook_addTodoNote,
    addAction: "note/addTodoNote",
    isEmpty: isTodoNoteEmpty,
    buildPayloadExtras,
    getTitleSource: (n) =>
      n.list
        .map((item) => item.text)
        .filter(Boolean)
        .join(" "),
  });

  /* local */

  const setTitle = useCallback(
    (titleVal: string) => {
      setNoteAsync({ ...note, title: titleVal });
    },
    [note, setNoteAsync]
  );

  const setTextListItem = useCallback(
    (id: string, text: string) => {
      const mutableList = Object.assign([], note.list);
      const index = mutableList.findIndex((todoItem) => todoItem.id === id);
      mutableList[index] = { ...mutableList[index], text: text };

      setNoteAsync({ ...note, list: mutableList });
    },
    [note, setNoteAsync]
  );

  const stepMode = note.mode === "steps";

  const firstUncheckedIndex = useMemo(() => note.list.findIndex((todoItem) => !todoItem.checked), [note.list]);

  const checkListItem = useCallback(
    (id: string) => {
      if (note.readOnly) {
        return;
      }

      const index = note.list.findIndex((todoItem: TodoItemType) => todoItem.id === id);
      if (index === -1) return;

      if (stepMode) {
        // Stepper toggle: clicking an unchecked step completes it and every
        // previous one; clicking an already-done step rolls back — it and every
        // step after become "not done" (so it turns ongoing). Re-tapping the
        // first step therefore returns to "nothing done / first ongoing".
        const wasChecked = note.list[index].checked;
        const mutableList = note.list.map((todoItem, i) => ({
          ...todoItem,
          checked: wasChecked ? i < index : i <= index,
        }));
        setNoteAsync({ ...note, list: mutableList });
        return;
      }

      const mutableList = Object.assign([], note.list);
      mutableList[index] = {
        ...mutableList[index],
        checked: !mutableList[index].checked,
      };

      setNoteAsync({ ...note, list: mutableList });
    },
    [note, setNoteAsync, stepMode]
  );

  // Autofocus is per-row: only the row whose id matches `focusId` grabs focus.
  // A brand-new note focuses its first row; opening an existing note focuses
  // nothing so the user can just read. `focusId` is seeded synchronously so the
  // target row mounts with autoFocus already set — setting it after mount is a
  // no-op because RN reads `autoFocus` only once.
  const isNewNote = useMemo(() => initialNote.createdAt === initialNote.updatedAt, [initialNote]);
  const [focusId, setFocusId] = useState<string | null>(
    isNewNote && !initialNote.readOnly ? (memoInitialNote.list[0]?.id ?? null) : null
  );

  // Mount-time autoFocus is frequently dropped while the screen transition is
  // still running, so re-focus the seeded row imperatively once it settles.
  const transitionDone = useScreenTransitionEnd();
  const focusInputRef = useRef<TextInput>(null);
  const didFocusRef = useRef(false);

  useEffect(() => {
    if (didFocusRef.current) return;
    if (!isNewNote || initialNote.readOnly || !transitionDone) return;
    didFocusRef.current = true;
    focusInputRef.current?.focus();
  }, [transitionDone, isNewNote, initialNote.readOnly]);

  const currentMode = stepMode ? "steps" : "free";

  const setMode = useCallback(
    (mode: TodoNote["mode"]) => {
      if (note.readOnly) {
        return;
      }
      // Switching mode remounts the rows; don't let their inputs grab focus.
      setFocusId(null);
      setNoteAsync({ ...note, mode });
    },
    [note, setNoteAsync]
  );

  const deleteListItem = useCallback(
    (id: string) => {
      if (note.readOnly) {
        return;
      }

      const mutableList = note.list.filter((todoItem) => todoItem.id !== id);

      setNoteAsync({ ...note, list: mutableList });
    },
    [note, setNoteAsync]
  );

  const numberOfAllItems = useMemo(() => note.list.length, [note.list]);
  const numberOfCheckedItems = useMemo(() => note.list.filter((todoItem) => todoItem.checked).length, [note.list]);

  /* global */

  const addListItem = useCallback(() => {
    if (note.readOnly) {
      return;
    }

    const newItem = { id: uuid(), text: "", checked: false };
    setNoteAsync({ ...note, list: [...note.list, newItem] });
    // Focus the freshly added row so the user can type without tapping it.
    setFocusId(newItem.id);
  }, [note, setNoteAsync]);

  // Enable row layout/entering/exiting animations only after the navigation
  // transition into this screen has finished, otherwise Reanimated crashes with
  // "Unable to find viewState for tag" when the list mounts mid-transition.
  const [animationsReady, setAnimationsReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setAnimationsReady(true), 400);
    return () => clearTimeout(id);
  }, []);

  const renderTodoItem = ({ item, drag, isActive }: { item: TodoItemType; drag: () => void; isActive: boolean }) => {
    const index = note.list.findIndex((todoItem) => todoItem.id === item.id);
    const stepStatus: "done" | "ongoing" | "future" = item.checked
      ? "done"
      : index === firstUncheckedIndex
        ? "ongoing"
        : "future";

    return (
      <TodoItem
        item={item}
        setText={setTextListItem}
        checkItem={checkListItem}
        deleteItem={deleteListItem}
        drag={drag}
        disabled={isActive || note.readOnly}
        autoFocus={item.id === focusId}
        inputRef={item.id === focusId ? focusInputRef : undefined}
        stepMode={stepMode}
        stepStatus={stepStatus}
        stepNumber={stepMode ? index + 1 : undefined}
        isFirst={index === 0}
        isLast={index === note.list.length - 1}
        animationsReady={animationsReady}
      />
    );
  };

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

              <NoteSettingsButton note={note} setNote={setNoteAsync} />
            </View>

            <View style={styles.subtitleWrapper}>
              <Text style={[styles.subtitle, { flexGrow: 1 }]}>
                {t("note.completed")}{" "}
                <Text
                  style={{
                    color: numberOfAllItems != numberOfCheckedItems ? COLOR.yellow : COLOR.importantIcon,
                  }}
                >
                  {numberOfCheckedItems}
                </Text>{" "}
                {t("note.on")} {numberOfAllItems}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={{ flex: 1 }}>
                <GestureHandlerRootView style={styles.draggableList}>
                  {note.list.length > 0 ? (
                    <DraggableFlatList
                      containerStyle={{ flex: 1 }}
                      style={{ flex: 1, paddingHorizontal: PADDING_MARGIN.lg }}
                      contentContainerStyle={{ paddingTop: PADDING_MARGIN.xl, paddingBottom: PADDING_MARGIN.md }}
                      ref={draggableListRef}
                      data={note.list}
                      onDragEnd={({ data }) => setNoteAsync({ ...note, list: data })}
                      keyExtractor={(item) => item.id}
                      renderItem={renderTodoItem}
                    />
                  ) : (
                    <Text style={styles.noItems}>{t("note.no_items")}</Text>
                  )}
                </GestureHandlerRootView>
              </View>
            </TouchableWithoutFeedback>
          </View>

          {!note.readOnly && (
            <EditorActionDock>
              <View style={dockGroupStyle}>
                <TodoModeMenuButton
                  currentMode={currentMode}
                  onSelectMode={setMode}
                  disabled={note.readOnly}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />

                <AIEditorActions
                  noteType="todo"
                  getContent={() =>
                    note.list
                      .map((item) => item.text)
                      .filter(Boolean)
                      .join(", ")
                  }
                  noteTitle={note.title}
                  onTitleGenerated={(title) => setNoteAsync({ ...note, title })}
                  onItemsSuggested={(items) => {
                    const newItems = items.map((text) => ({
                      id: uuid(),
                      text: capitalize(text),
                      checked: false,
                    }));
                    setNoteAsync({ ...note, list: [...note.list, ...newItems] });
                  }}
                  onCategorySuggested={(name) => {
                    const cat = findCategoryByName(name);
                    if (cat) setNoteAsync({ ...note, category: cat });
                  }}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />

                <VoiceRecognitionButton
                  onInsert={(text) => {
                    const lines = voiceTextToLines(text);
                    if (lines.length === 0) return;

                    const mutableList = [...note.list];
                    const last = mutableList[mutableList.length - 1];
                    let startIndex = 0;

                    // reuse a trailing empty item for the first dictated line
                    if (last && !last.text.trim()) {
                      mutableList[mutableList.length - 1] = { ...last, text: lines[0] };
                      startIndex = 1;
                    }

                    for (let i = startIndex; i < lines.length; i++) {
                      mutableList.push({ id: uuid(), text: lines[i], checked: false });
                    }

                    setNoteAsync({ ...note, list: mutableList });
                  }}
                  aiCleanup
                  style={dockButtonStyle}
                />
              </View>

              <TouchableOpacity activeOpacity={0.7} style={styles.addButton} onPress={addListItem}>
                <PlusIcon size={28} color={COLOR.softWhite} />
              </TouchableOpacity>
            </EditorActionDock>
          )}
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
    flex: 1,
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
  subtitleWrapper: {
    flexGrow: 1,
    marginTop: PADDING_MARGIN.sm,
    marginHorizontal: PADDING_MARGIN.xl,
    flexDirection: "row",
  },
  subtitle: {
    marginTop: PADDING_MARGIN.xs,
    textAlign: "center",
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.medium,
    color: COLOR.textSecondary,
  },
  draggableList: {
    flex: 1,
  },
  addButton: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  noItems: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.cardTitle,
    textAlign: "center",
    marginTop: PADDING_MARGIN.xl,
    opacity: 0.7,
    lineHeight: 25,
  },
});
