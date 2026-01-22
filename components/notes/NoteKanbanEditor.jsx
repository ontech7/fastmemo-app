import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PlusIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView, KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

import { storeDirtyNoteId } from "@/libs/registry";
import { formatDateTime } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { webhook } from "@/utils/webhook";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import SafeAreaView from "@/components/SafeAreaView";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_addKanbanNote,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

const COLUMN_COLORS = ["#EEE78E", "#A7ABB9", "#B66465", "#B9B5A7", "#DAD9DE"];

export default function NoteKanbanEditor({ initialNote }) {
  const { t } = useTranslation();

  const webhook_addKanbanNote = useSelector(selectorWebhook_addKanbanNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();

  const [note, setNote] = useState({
    ...initialNote,
    type: initialNote.type || "kanban",
    columns:
      initialNote.columns?.length > 0 ? initialNote.columns : [{ id: uuid(), name: "", color: COLUMN_COLORS[0], items: [] }],
  });

  const isNewlyCreated = note.createdAt === note.updatedAt;

  // Send webhook on just created note only once
  useEffect(() => {
    if (!isNewlyCreated) {
      return;
    }

    webhook(webhook_addKanbanNote, {
      action: "note/addKanbanNote",
      id: note.id,
      type: "kanban",
      title: note.title,
      columns: note.columns,
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

  const updateNoteGlobal = useCallback(
    (currNote) => {
      const no_title = isStringEmpty(currNote.title);
      const no_columns = !currNote.columns?.length;
      const no_cards = currNote.columns?.every((col) => !col.items?.length);

      if (no_title && (no_columns || no_cards)) {
        dispatch(temporaryDeleteNote(currNote.id));
        dispatch(deleteNote(currNote.id));
        return;
      }

      dispatch(
        addNote({
          ...currNote,
          type: currNote.type || "kanban",
          updatedAt: Date.now(),
          date: formatDateTime(),
        })
      );
    },
    [dispatch]
  );

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
  }, [note.id]);

  useEffect(() => {
    return () => {
      dirtyRef.current = false;
    };
  }, []);

  const setNoteAsync = useCallback(
    (currNote) => {
      if (!dirtyRef.current) {
        storeDirtyNoteId(currNote.id);
        dirtyRef.current = true;
      }
      setNote(currNote);
      updateNoteGlobal(currNote);
    },
    [updateNoteGlobal]
  );

  /* Title */

  const setTitle = useCallback(
    (titleVal) => {
      setNoteAsync({ ...note, title: titleVal });
    },
    [note, setNoteAsync]
  );

  /* Column operations */

  const addColumn = useCallback(() => {
    if (note.readOnly) return;
    if (note.columns.length >= 5) return;

    const colorIndex = note.columns.length % COLUMN_COLORS.length;
    setNoteAsync({
      ...note,
      columns: [
        ...note.columns,
        {
          id: uuid(),
          name: "",
          color: COLUMN_COLORS[colorIndex],
          items: [],
        },
      ],
    });
  }, [note, setNoteAsync]);

  const setColumnName = useCallback(
    (columnId, name) => {
      const columns = note.columns.map((col) => (col.id === columnId ? { ...col, name } : col));
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const setColumnColor = useCallback(
    (columnId, color) => {
      const columns = note.columns.map((col) => (col.id === columnId ? { ...col, color } : col));
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const deleteColumn = useCallback(
    (columnId) => {
      if (note.readOnly) return;

      const columns = note.columns.filter((col) => col.id !== columnId);
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  /* Card operations */

  const addCard = useCallback(
    (columnId) => {
      if (note.readOnly) return;

      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: [...col.items, { id: uuid(), text: "", createdAt: Date.now() }],
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const setCardText = useCallback(
    (columnId, cardId, text) => {
      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: col.items.map((item) => (item.id === cardId ? { ...item, text } : item)),
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const deleteCard = useCallback(
    (columnId, cardId) => {
      if (note.readOnly) return;

      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          items: col.items.filter((item) => item.id !== cardId),
        };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const reorderCards = useCallback(
    (columnId, newItems) => {
      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return { ...col, items: newItems };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
  );

  const moveCard = useCallback(
    (cardId, fromColumnId, toColumnId, toIndex) => {
      if (note.readOnly) return;

      let cardToMove;
      const columns = note.columns.map((col) => {
        if (col.id === fromColumnId) {
          cardToMove = col.items.find((item) => item.id === cardId);
          return { ...col, items: col.items.filter((item) => item.id !== cardId) };
        }
        return col;
      });

      if (!cardToMove) return;

      const finalColumns = columns.map((col) => {
        if (col.id === toColumnId) {
          const newItems = [...col.items];
          newItems.splice(toIndex, 0, cardToMove);
          return { ...col, items: newItems };
        }
        return col;
      });

      setNoteAsync({ ...note, columns: finalColumns });
    },
    [note, setNoteAsync]
  );

  /* Stats */

  const numberOfColumns = useMemo(() => note.columns.length, [note.columns]);
  const numberOfCards = useMemo(() => note.columns.reduce((acc, col) => acc + col.items.length, 0), [note.columns]);

  /* Webhook on back */

  const updateNoteWebhook = useCallback(async () => {
    const no_title = isStringEmpty(note.title);
    const no_columns = !note.columns?.length;
    const no_cards = note.columns?.every((col) => !col.items?.length);

    if (no_title && (no_columns || no_cards)) {
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
        type: note.type || "kanban",
        title: note.title,
        columns: note.columns,
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
  }, [webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote, note]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      return false;
    });

    return () => backHandler.remove();
  }, [updateNoteWebhook]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        KeyboardController.dismiss();
        Keyboard.dismiss();
      };
    }, [])
  );

  const [autoFocus, setAutoFocus] = useState(false);

  useEffect(() => {
    setTimeout(() => setAutoFocus(true), 20);
  }, []);

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
              {numberOfColumns} {t("kanban.columns_count")} | {numberOfCards} {t("kanban.cards_count")}
            </Text>
          </View>
        </View>

        <View style={styles.boardContainer}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {note.columns.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsScrollView}>
                {note.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    columns={note.columns}
                    setColumnName={setColumnName}
                    setColumnColor={setColumnColor}
                    deleteColumn={deleteColumn}
                    setCardText={setCardText}
                    deleteCard={deleteCard}
                    addCard={addCard}
                    moveCard={moveCard}
                    reorderCards={reorderCards}
                    disabled={note.readOnly}
                    autoFocus={autoFocus}
                    t={t}
                  />
                ))}

                {/* Add Column Button */}
                {!note.readOnly && note.columns.length < 5 && (
                  <TouchableOpacity activeOpacity={0.7} style={styles.addColumnButton} onPress={addColumn}>
                    <PlusIcon size={32} color={COLOR.lightBlue} />
                    <Text style={styles.addColumnText}>{t("kanban.add_column")}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyBoard}>
                <Text style={styles.emptyBoardText}>{t("kanban.no_columns")}</Text>
                {!note.readOnly && (
                  <TouchableOpacity activeOpacity={0.7} style={styles.addFirstColumnButton} onPress={addColumn}>
                    <PlusIcon size={24} color={COLOR.darkBlue} />
                    <Text style={styles.addFirstColumnText}>{t("kanban.add_column")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </GestureHandlerRootView>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

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
  maxColumnsText: {
    color: "#B66465",
    fontWeight: FONTWEIGHT.semiBold,
  },
  remainingText: {
    color: COLOR.lightBlue,
    fontWeight: FONTWEIGHT.semiBold,
  },
  boardContainer: {
    flex: 1,
    marginTop: PADDING_MARGIN.lg,
  },
  columnsScrollView: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.lg,
  },
  addColumnButton: {
    width: 170,
    height: SIZE.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    borderStyle: "dashed",
    borderRadius: BORDER.normal,
  },
  addColumnText: {
    marginTop: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.small,
    color: COLOR.lightBlue,
    textAlign: "center",
  },
  emptyBoard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.xl,
  },
  emptyBoardText: {
    color: COLOR.placeholder,
    fontSize: FONTSIZE.cardTitle,
    textAlign: "center",
    lineHeight: 25,
  },
  addFirstColumnButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.lightBlue,
    borderRadius: BORDER.normal,
  },
  addFirstColumnText: {
    marginLeft: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.darkBlue,
  },
});
