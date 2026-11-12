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
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
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
import TodoItem from "@/components/todo/TodoItem.native";
import AppBackground from "@/components/ui/AppBackground";
import DropSlot, { ROW_DELETE_INSET } from "@/components/ui/DropSlot";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { useTodoList } from "@/hooks/useTodoList";
import Haptics, { ImpactFeedbackStyle, NotificationFeedbackType } from "@/libs/haptics";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import type { TodoItem as TodoItemType, TodoNote } from "@/types";

interface Props {
  initialNote: TodoNote;
}

export default function NoteTodoEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const draggableListRef = useRef(null);

  const {
    note,
    setNoteAsync,
    flushNote,
    updateNoteWebhook,
    autoTitle,
    autofocus,
    focusId,
    stepMode,
    firstUncheckedIndex,
    total,
    done,
    setTitle,
    setItemText,
    checkItem,
    deleteItem,
    addItem,
    setMode,
    reorder,
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

  // Not a function of the list: a keystroke changes one item, and only that row renders again (the list hands each
  // row a stable `drag` and `getIndex`). What every row shows (the mode, the focus, the ongoing step, the last row)
  // is a dependency, so a change there reaches every row, and `memo` keeps the rows whose props stayed the same.
  const dropping = useSharedValue(0);
  const renderTodoItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<TodoItemType>) => {
      const index = getIndex() ?? 0;
      const stepStatus: "done" | "ongoing" | "future" = item.checked
        ? "done"
        : index === firstUncheckedIndex
          ? "ongoing"
          : "future";

      return (
        <TodoItem
          item={item}
          setText={setItemText}
          checkItem={checkItem}
          deleteItem={deleteItem}
          drag={drag}
          lifted={isActive}
          dropping={isActive ? dropping : undefined}
          disabled={isActive || readOnly}
          autoFocus={item.id === focusId}
          inputRef={item.id === focusId ? focusInputRef : undefined}
          stepMode={stepMode}
          stepStatus={stepStatus}
          stepNumber={stepMode ? index + 1 : undefined}
          isFirst={index === 0}
          isLast={index === total - 1}
          animationsReady={animationsReady}
        />
      );
    },
    [focusId, stepMode, firstUncheckedIndex, total, readOnly, animationsReady, setItemText, checkItem, deleteItem, dropping]
  );

  // The kanban drag's feel (ADR-037): a firm tap at lift, a tick each time the slot moves, a success when it moved.
  // The lifted row settles flat from the release, on the UI thread: the drop counts only once the row has landed.
  const onDragBegin = useCallback(() => {
    dropping.set(0);
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
  }, [dropping]);
  const onRelease = useCallback(() => dropping.set(1), [dropping]);
  const onPlaceholderIndexChange = useCallback(() => Haptics.selectionAsync(), []);
  const onDragEnd = useCallback(
    ({ data, from, to }: { data: TodoItemType[]; from: number; to: number }) => {
      if (from !== to) Haptics.notificationAsync(NotificationFeedbackType.Success);
      reorder(data);
    },
    [reorder]
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
                    <DraggableFlatList
                      containerStyle={{ flex: 1 }}
                      style={{ flex: 1, paddingHorizontal: PADDING_MARGIN.lg }}
                      contentContainerStyle={{ paddingTop: PADDING_MARGIN.xl, paddingBottom: PADDING_MARGIN.md }}
                      ref={draggableListRef}
                      data={note.list}
                      onDragBegin={onDragBegin}
                      onRelease={onRelease}
                      onPlaceholderIndexChange={onPlaceholderIndexChange}
                      onDragEnd={onDragEnd}
                      renderPlaceholder={renderSlot}
                      animationConfig={DROP_SPRING}
                      windowSize={LIST_WINDOW}
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

/**
 * The rows making room and the drop landing, in about LIFT.dropMs. A little under critical damping, and clamped: it reaches
 * its place in ~105 ms and stops there. Critically damped, it crept ~150 ms more before the drop counted; the library's
 * default (overdamped, mass 0.2, stiffness 100) crawls for about a second, and the next drag waits on it.
 */
const DROP_SPRING = {
  mass: 0.2,
  stiffness: 200,
  damping: 9,
  overshootClamping: true,
  restSpeedThreshold: 1,
  restDisplacementThreshold: 0.5,
};

/**
 * Screens of rows kept mounted (the visible one included). FlatList's default, 21, mounts a 300-item list whole, and every
 * mounted row runs the drag's per-frame worklet and re-attaches it at lift and at drop: the drop froze for ~80 ms on a
 * Pixel. Five screens still cover a fling.
 */
const LIST_WINDOW = 5;

/**
 * Where the row being dragged will land: the same slot as a kanban card's, in the row's place. The list draws its
 * placeholder outside its side padding, so the slot keeps it itself.
 */
const renderSlot = () => <DropSlot style={styles.slot} />;

const styles = StyleSheet.create({
  slot: {
    marginBottom: PADDING_MARGIN.sm,
    marginLeft: PADDING_MARGIN.lg,
    marginRight: PADDING_MARGIN.lg + ROW_DELETE_INSET,
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
