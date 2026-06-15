import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton.web";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { selectorWebhook_addTodoNote } from "@/slicers/settingsSlice";
import { isStringEmpty } from "@/utils/string";
import { voiceTextToLines } from "@/utils/voiceTranscript";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { PlusIcon } from "react-native-heroicons/outline";
import uuid from "react-uuid";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import TodoModeMenuButton from "@/components/notes/TodoModeMenuButton";
import TodoItem from "@/components/todo/TodoItem.web";

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
  // no-op because the input reads `autoFocus` only once.
  const isNewNote = useMemo(() => initialNote.createdAt === initialNote.updatedAt, [initialNote]);
  const [focusId, setFocusId] = useState<string | null>(
    isNewNote && !initialNote.readOnly ? (memoInitialNote.list[0]?.id ?? null) : null
  );

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

  const addListItem = useCallback(() => {
    if (note.readOnly) {
      return;
    }

    const newItem = { id: uuid(), text: "", checked: false };
    setNoteAsync({ ...note, list: [...note.list, newItem] });
    // Focus the freshly added row so the user can type without clicking it.
    setFocusId(newItem.id);
  }, [note, setNoteAsync]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = note.list.findIndex((item) => item.id === active.id);
      const newIndex = note.list.findIndex((item) => item.id === over.id);

      const newList = arrayMove(note.list, oldIndex, newIndex);
      setNoteAsync({ ...note, list: newList });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

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

      <View
        style={{
          flex: 1,
          position: "relative",
          maxWidth: 800,
          width: SIZE.full,
          marginHorizontal: "auto",
          paddingVertical: PADDING_MARGIN.lg,
        }}
      >
        <ScrollView style={styles.draggableList}>
          {note.list.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={note.list.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {note.list.map((item, index) => {
                  const stepStatus: "done" | "ongoing" | "future" = item.checked
                    ? "done"
                    : index === firstUncheckedIndex
                      ? "ongoing"
                      : "future";

                  return (
                    <TodoItem
                      key={item.id}
                      item={item}
                      setText={setTextListItem}
                      checkItem={checkListItem}
                      deleteItem={deleteListItem}
                      disabled={note.readOnly}
                      autoFocus={item.id === focusId}
                      stepMode={stepMode}
                      stepStatus={stepStatus}
                      stepNumber={stepMode ? index + 1 : undefined}
                      isFirst={index === 0}
                      isLast={index === note.list.length - 1}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          ) : (
            <Text style={styles.noItems}>{t("note.no_items")}</Text>
          )}
        </ScrollView>
      </View>

      {!note.readOnly && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarLeft}>
            <TodoModeMenuButton
              currentMode={currentMode}
              onSelectMode={setMode}
              disabled={note.readOnly}
              style={styles.barButton}
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
              style={styles.barButton}
            />
          </View>

          <TouchableOpacity activeOpacity={0.7} style={styles.addButton} onPress={addListItem}>
            <PlusIcon size={28} color={COLOR.softWhite} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

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
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.xl,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingTop: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS.border,
  },
  actionBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
  },
  // Neutralizes the floating-FAB positioning of mode/voice so they sit inline in the bar.
  barButton: {
    position: "relative",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
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
