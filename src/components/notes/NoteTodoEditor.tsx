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
import { EyeIcon, EyeSlashIcon, PlusIcon, TrashIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import uuid from "react-uuid";

import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import SafeAreaView from "@/components/SafeAreaView";
import TodoItem from "@/components/todo/TodoItem.native";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName } from "@/libs/ai";
import { selectorWebhook_addTodoNote } from "@/slicers/settingsSlice";
import { capitalize, isStringEmpty } from "@/utils/string";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

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
  const buildPayload = useCallback(
    (n: TodoNote) => ({
      id: n.id,
      type: n.type || "todo",
      title: n.title,
      list: n.list,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      important: n.important,
      readOnly: n.readOnly,
      hidden: n.hidden,
      locked: n.locked,
      category: {
        iconId: n.category.icon,
        name: n.category.name,
      },
    }),
    []
  );

  const { note, setNoteAsync, updateNoteWebhook } = useNoteEditor<TodoNote>({
    initialNote: memoInitialNote,
    defaultType: "todo",
    addWebhookSelector: selectorWebhook_addTodoNote,
    addAction: "note/addTodoNote",
    isEmpty: isTodoNoteEmpty,
    buildAddPayload: buildPayload,
    buildUpdatePayload: buildPayload,
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

  const checkListItem = useCallback(
    (id: string) => {
      if (note.readOnly) {
        return;
      }

      const mutableList = Object.assign([], note.list);
      const index = mutableList.findIndex((todoItem: TodoItemType) => todoItem.id === id);
      mutableList[index] = {
        ...mutableList[index],
        checked: !mutableList[index].checked,
      };

      setNoteAsync({ ...note, list: mutableList });
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

  const deleteAllList = useCallback(() => {
    if (note.readOnly) {
      return;
    }

    setNoteAsync({ ...note, list: [] });
  }, [note, setNoteAsync]);

  const [hideDoneItems, setHideDoneItems] = useState(false);

  const toggleHideDoneItems = useCallback(() => {
    setHideDoneItems((prev) => !prev);
  }, []);

  const [autoFocus, setAutoFocus] = useState(false);

  useEffect(() => {
    setTimeout(() => setAutoFocus(true), 20);
  }, []);

  const renderTodoItem = ({ item, drag, isActive }: { item: TodoItemType; drag: () => void; isActive: boolean }) => (
    <TodoItem
      item={item}
      setText={setTextListItem}
      checkItem={checkListItem}
      deleteItem={deleteListItem}
      drag={drag}
      disabled={isActive || note.readOnly}
      hidden={hideDoneItems}
      autoFocus={autoFocus}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View>
          <View style={styles.header}>
            <BackButton callback={updateNoteWebhook} />

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
                    style={{
                      paddingHorizontal: PADDING_MARGIN.lg,
                      height: "100%",
                    }}
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

              <TouchableOpacity activeOpacity={0.7} style={styles.addListItemButton} onPress={addListItem}>
                <PlusIcon size={28} color={COLOR.darkBlue} />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} style={styles.hideDoneItemsButton} onPress={toggleHideDoneItems}>
                {!hideDoneItems ? (
                  <EyeSlashIcon size={24} color={COLOR.darkBlue} />
                ) : (
                  <EyeIcon size={24} color={COLOR.darkBlue} />
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} style={styles.deleteAllListButton} onPress={deleteAllList}>
                <TrashIcon size={24} color={COLOR.darkBlue} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>

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

        {!note.readOnly && (
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
            style={{ bottom: 135 }}
            menuBottomOffset={200}
          />
        )}
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
    flex: 1,
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
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.lightBlue,
  },
  draggableList: {
    height: SIZE.full,
    paddingBottom: 200,
    marginTop: PADDING_MARGIN.xl,
  },
  listItemInput: {
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 4,
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkbox: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  addListItemButton: {
    zIndex: 2,
    position: "absolute",
    bottom: 20,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  hideDoneItemsButton: {
    zIndex: 2,
    position: "absolute",
    bottom: 26,
    right: 115,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  deleteAllListButton: {
    zIndex: 2,
    position: "absolute",
    bottom: 26,
    left: 40,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  noItems: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.cardTitle,
    textAlign: "center",
    marginTop: PADDING_MARGIN.xl,
    opacity: 0.7,
    lineHeight: 25,
  },
});
