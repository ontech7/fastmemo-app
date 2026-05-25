import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton.web";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { selectorWebhook_addTodoNote } from "@/slicers/settingsSlice";
import { capitalize, isStringEmpty } from "@/utils/string";
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
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const { note, setNoteAsync, updateNoteWebhook } = useNoteEditor<TodoNote>({
    initialNote: memoInitialNote,
    defaultType: "todo",
    addWebhookSelector: selectorWebhook_addTodoNote,
    addAction: "note/addTodoNote",
    isEmpty: isTodoNoteEmpty,
    buildPayloadExtras,
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

  const [autoFocus, setAutoFocus] = useState(false);

  useEffect(() => {
    setTimeout(() => setAutoFocus(true), 20);
  }, []);

  const currentMode = stepMode ? "steps" : "free";

  const setMode = useCallback(
    (mode: TodoNote["mode"]) => {
      if (note.readOnly) {
        return;
      }
      // Switching mode remounts the rows; don't let their inputs grab focus.
      setAutoFocus(false);
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

    setNoteAsync({
      ...note,
      list: [
        ...note.list,
        {
          id: uuid(),
          text: "",
          checked: false,
        },
      ],
    });
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
            placeholder={t("note.title_placeholder")}
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
                      autoFocus={autoFocus}
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

        <TouchableOpacity activeOpacity={0.7} style={styles.addListItemButton} onPress={addListItem}>
          <PlusIcon size={28} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      <TodoModeMenuButton currentMode={currentMode} onSelectMode={setMode} disabled={note.readOnly} />

      {!note.readOnly && (
        <VoiceRecognitionButton
          setTranscript={(transcript, isFinal) => {
            if (isFinal) {
              if (!transcript.trim()) {
                return;
              }

              let lastItem = note.list[note.list.length - 1];
              const mutableList = [...note.list];

              if (!lastItem || lastItem.text.trim()) {
                lastItem = {
                  id: uuid(),
                  text: "",
                  checked: false,
                };
                mutableList.push(lastItem);
              }

              const index = mutableList.findIndex((todoItem) => todoItem.id === lastItem.id);
              mutableList[index] = { ...mutableList[index], text: capitalize(transcript.trim()) };

              setNoteAsync({
                ...note,
                list: mutableList,
              });
            }
          }}
          style={{
            bottom: 135,
          }}
        />
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
    paddingBottom: 200,
    marginTop: PADDING_MARGIN.xl,
  },
  addListItemButton: {
    zIndex: 2,
    position: "absolute",
    bottom: 20,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
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
