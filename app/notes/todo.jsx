import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BackHandler,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

import { retrieveNote } from "@/libs/registry";
import { formatDate } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { webhook } from "@/utils/webhook";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import TodoItem from "@/components/todo/TodoItem";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_addTodoNote,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function NoteTodoScreen() {
  const { t } = useTranslation();

  const { id, type, title, list, createdAt, updatedAt, date, category, important, readOnly, hidden, locked } = retrieveNote();

  const draggableListRef = useRef(null);

  const webhook_addTodoNote = useSelector(selectorWebhook_addTodoNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const currentCategory = useSelector(getCurrentCategory);

  const dispatch = useDispatch();

  /* note */

  const [note, setNote] = useState({
    id: id || uuid(),
    type: type || "todo",
    title: title || "",
    list: list?.length > 0 ? list : [{ id: uuid(), text: "", checked: false }],
    createdAt: createdAt || new Date().getTime(),
    updatedAt: updatedAt || new Date().getTime(),
    date: date || formatDate(),
    category: category || currentCategory,
    important: important || false,
    readOnly: readOnly || false,
    hidden: hidden || false,
    locked: locked || false,
  });

  const isNewlyCreated = note.createdAt === note.updatedAt;

  // Send webhook on just created note only once
  useEffect(() => {
    if (!isNewlyCreated) {
      return;
    }

    webhook(webhook_addTodoNote, {
      action: "note/addTodoNote",
      id: note.id,
      type: "todo",
      title: note.title,
      list: note.list,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      important: note.important,
      readOnly: note.readOnly,
      hidden: note.hidden,
      locked: note.locked,
      category: {
        iconId: note.category.icon,
        name: note.category.name,
      },
    });
  }, [isNewlyCreated]);

  const updateNoteGlobal = useCallback((currNote) => {
    const no_title = isStringEmpty(currNote.title);
    const no_list_items = !currNote.list?.length || (currNote.list?.length == 1 && isStringEmpty(currNote.list?.[0].text));

    if (no_title && no_list_items) {
      dispatch(temporaryDeleteNote(currNote.id));
      dispatch(deleteNote(currNote.id));
      return;
    }

    dispatch(
      addNote({
        id: currNote.id,
        type: currNote.type,
        title: currNote.title,
        list: currNote.list,
        createdAt: currNote.createdAt,
        updatedAt: new Date().getTime(),
        date: formatDate(),
        category: currNote.category,
        important: currNote.important,
        readOnly: currNote.readOnly,
        hidden: currNote.hidden,
        locked: currNote.locked,
      })
    );
  }, []);

  const setNoteAsync = useCallback((currNote) => {
    setNote(currNote);
    updateNoteGlobal(currNote);
  }, []);

  /* local */

  const setTitle = useCallback(
    (titleVal) => {
      setNoteAsync({ ...note, title: titleVal });
    },
    [note]
  );

  const setTextListItem = useCallback(
    (id, text) => {
      let mutableList = Object.assign([], note.list);
      const index = mutableList.findIndex((todoItem) => todoItem.id === id);
      mutableList[index] = { ...mutableList[index], text: text };

      setNoteAsync({ ...note, list: mutableList });
    },
    [note]
  );

  const checkListItem = useCallback(
    (id) => {
      if (note.readOnly) {
        return;
      }

      let mutableList = Object.assign([], note.list);
      const index = mutableList.findIndex((todoItem) => todoItem.id === id);
      mutableList[index] = {
        ...mutableList[index],
        checked: !mutableList[index].checked,
      };

      setNoteAsync({ ...note, list: mutableList });
    },
    [note]
  );

  const deleteListItem = useCallback(
    (id) => {
      if (note.readOnly) {
        return;
      }

      const mutableList = note.list.filter((todoItem) => todoItem.id !== id);

      setNoteAsync({ ...note, list: mutableList });
    },
    [note]
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
  }, [note]);

  const deleteAllList = useCallback(() => {
    if (note.readOnly) {
      return;
    }

    setNoteAsync({ ...note, list: [] });
  }, [note]);

  const [hideDoneItems, setHideDoneItems] = useState(false);

  const toggleHideDoneItems = useCallback(() => {
    if (note.readOnly) {
      return;
    }

    setHideDoneItems((prev) => !prev);
  }, [note.readOnly]);

  /* change category */

  useEffect(() => {
    if (category?.icon && category.icon !== note.category?.icon) {
      setNoteAsync({
        ...note,
        category,
      });
    }
  }, [category?.icon]);

  /* locked note */

  useEffect(() => {
    if (locked !== undefined && locked !== note.locked) {
      setNoteAsync({
        id,
        type,
        title,
        list,
        createdAt,
        updatedAt,
        date,
        category,
        important,
        readOnly,
        hidden,
        locked,
      });
    }
  }, [locked]);

  // updateNote webhook
  const updateNoteWebhook = useCallback(() => {
    const asyncUpdateNote = async () => {
      const no_title = isStringEmpty(note.title);
      const no_list_items = !note.list?.length || (note.list?.length == 1 && isStringEmpty(note.list?.[0].text));

      if (no_title && no_list_items) {
        await webhook(webhook_temporaryDeleteNote, {
          action: "note/temporaryDeleteNote",
          id: note.id,
        });
        await webhook(webhook_deleteNote, {
          action: "note/deleteNote",
          id: note.id,
        });
      } else {
        await webhook(webhook_updateNote, {
          action: "note/updateNote",
          id: note.id,
          type: note.type,
          title: note.title,
          list: note.list,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          important: note.important,
          readOnly: note.readOnly,
          hidden: note.hidden,
          locked: note.locked,
          category: {
            iconId: note.category.icon,
            name: note.category.name,
          },
        });
      }
    };

    asyncUpdateNote();
  }, [webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote, note]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      return false;
    });

    return () => backHandler.remove();
  }, [updateNoteWebhook]);

  /* render item */

  const [autoFocus, setAutoFocus] = useState(false);

  useEffect(() => {
    setTimeout(() => setAutoFocus(true), 20);
  }, []);

  const renderTodoItem = ({ item, drag, isActive }) => (
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

              <TouchableOpacity style={styles.addListItemButton} onPress={addListItem}>
                <PlusIcon size={28} color={COLOR.darkBlue} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.hideDoneItemsButton} onPress={toggleHideDoneItems}>
                {!hideDoneItems ? (
                  <EyeSlashIcon size={24} color={COLOR.darkBlue} />
                ) : (
                  <EyeIcon size={24} color={COLOR.darkBlue} />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteAllListButton} onPress={deleteAllList}>
                <TrashIcon size={24} color={COLOR.darkBlue} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
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
    bottom: 45,
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
    bottom: 51,
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
    bottom: 51,
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
