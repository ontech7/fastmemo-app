import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import EditorTourTip from "@/components/notes/EditorTourTip";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import TodoModeMenuButton from "@/components/notes/TodoModeMenuButton";
import SafeAreaView from "@/components/SafeAreaView";
import TodoItem from "@/components/todo/TodoItem";
import HiddenDoneRow from "@/components/todo/HiddenDoneRow";
import TodoList, { type RowDrag } from "@/components/todo/TodoList";
import AppBackground from "@/components/ui/AppBackground";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { useTodoList } from "@/hooks/useTodoList";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import type { TodoItem as TodoItemType, TodoNote } from "@/types";

interface Props {
  initialNote: TodoNote;
}

export default function NoteTodoEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const {
    note,
    setNoteAsync,
    flushNote,
    updateNoteWebhook,
    autoTitle,
    autofocus,
    focusId,
    focusSeq,
    stepMode,
    firstUncheckedId,
    positionOf,
    total,
    done,
    hideDone,
    visible,
    hiddenCount,
    setTitle,
    setItemText,
    checkItem,
    deleteItem,
    addItem,
    addItemAfter,
    removeEmptyItem,
    setHideDone,
    deleteDone,
    setMode,
    moveItemTo,
    addSuggestedItems,
    insertVoiceLines,
    setTitleFromAI,
    setCategoryFromAI,
  } = useTodoList(initialNote);

  // Mount-time autoFocus is frequently dropped while the screen transition is
  // still running, so re-focus the seeded row imperatively once it settles.
  const transitionDone = useScreenTransitionEnd();
  const focusInputRef = useRef<TextInputInstance>(null);
  const didFocusRef = useRef(false);

  useEffect(() => {
    if (didFocusRef.current) return;
    if (!autofocus || !transitionDone) return;
    didFocusRef.current = true;
    focusInputRef.current?.focus();
  }, [transitionDone, autofocus]);

  const currentMode = stepMode ? "steps" : "free";

  // Enable row layout/entering/exiting animations only after the navigation
  // transition into this screen has finished, otherwise Reanimated crashes with
  // "Unable to find viewState for tag" when the list mounts mid-transition.
  const [animationsReady, setAnimationsReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setAnimationsReady(true), 400);
    return () => clearTimeout(id);
  }, []);

  const readOnly = !!note.readOnly;

  // Not a function of the list: a keystroke changes one item, and only that row renders again. What every row shows (the
  // mode, the focus, the ongoing step, the last row) is a dependency, so a change there reaches every row, and `memo`
  // keeps the rows whose props stayed the same. `drag` changes only while a row is in the air (ADR-038).
  const renderTodoItem = useCallback(
    (item: TodoItemType, index: number, drag: RowDrag) => {
      const stepStatus: "done" | "ongoing" | "future" = item.checked
        ? "done"
        : item.id === firstUncheckedId
          ? "ongoing"
          : "future";
      const focused = item.id === focusId;

      return (
        <TodoItem
          item={item}
          setText={setItemText}
          checkItem={checkItem}
          deleteItem={deleteItem}
          disabled={readOnly}
          folded={drag.folded}
          slotHeight={drag.slotHeight}
          autoFocus={focused}
          inputRef={focused ? focusInputRef : undefined}
          stepMode={stepMode}
          stepStatus={stepStatus}
          stepNumber={stepMode ? (positionOf.get(item.id) ?? index) + 1 : undefined}
          isLast={index === visible.length - 1}
          addAfter={addItemAfter}
          removeEmpty={removeEmptyItem}
          focusSeq={focused ? focusSeq : 0}
          animationsReady={animationsReady}
        />
      );
    },
    [
      focusId,
      focusSeq,
      stepMode,
      firstUncheckedId,
      positionOf,
      visible.length,
      readOnly,
      animationsReady,
      setItemText,
      checkItem,
      deleteItem,
      addItemAfter,
      removeEmptyItem,
    ]
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

              <NoteSettingsButton note={note} setNote={setNoteAsync} flushNote={flushNote} />
            </View>
            <NotePresenceBanner noteId={note.id} />

            <View style={styles.subtitleWrapper}>
              <Text style={[styles.subtitle, { flexGrow: 1 }]}>
                <Trans
                  t={t}
                  i18nKey="note.progress"
                  values={{ done, total }}
                  components={{
                    hl: <Text style={{ color: total !== done ? COLOR.yellow : COLOR.importantIcon }} />,
                  }}
                />
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={{ flex: 1 }}>
                <GestureHandlerRootView style={styles.draggableList}>
                  {note.list.length > 0 ? (
                    <TodoList
                      list={visible}
                      renderRow={renderTodoItem}
                      moveItemTo={moveItemTo}
                      footer={hiddenCount > 0 ? <HiddenDoneRow count={hiddenCount} onShow={() => setHideDone(false)} /> : null}
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
                  hideDone={hideDone}
                  onToggleHideDone={() => setHideDone(!hideDone)}
                  doneCount={done}
                  onDeleteDone={deleteDone}
                  disabled={note.readOnly}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />

                <AIEditorActions
                  noteType="todo"
                  getContent={() =>
                    // one item per line: the suggestions leave out what the list already has, line by line
                    note.list
                      .map((item) => item.text)
                      .filter(Boolean)
                      .join("\n")
                  }
                  noteTitle={note.title}
                  categoryName={note.category.name}
                  onTitleGenerated={setTitleFromAI}
                  onItemsSuggested={addSuggestedItems}
                  onCategorySuggested={setCategoryFromAI}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />

                <VoiceRecognitionButton onInsert={insertVoiceLines} aiCleanup asItems style={dockButtonStyle} />
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.addButton}
                onPress={addItem}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.add_item")}
              >
                <PlusIcon size={28} color={COLOR.softWhite} />
              </TouchableOpacity>
            </EditorActionDock>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <EditorTourTip />
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
