import { KanbanDragProvider } from "@/contexts/KanbanDragContext";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView, KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import SafeAreaView from "@/components/SafeAreaView";
import { storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_addKanbanNote,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { isStringEmpty } from "@/utils/string";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, KANBAN_COLUMN_COLORS, PADDING_MARGIN, SIZE } from "@/constants/styles";

import KanbanBoard from "../kanban/KanbanBoard";

const COLUMN_PEEK = 40;

export default function NoteKanbanEditor({ initialNote }) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const columnWidth = Math.min(screenWidth, 500) - PADDING_MARGIN.lg * 2 - COLUMN_PEEK;
  const snapInterval = columnWidth + PADDING_MARGIN.md;

  const webhook_addKanbanNote = useSelector(selectorWebhook_addKanbanNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();
  const scrollViewRef = useRef(null);

  const [note, setNote] = useState({
    ...initialNote,
    type: initialNote.type || "kanban",
    columns:
      initialNote.columns?.length > 0
        ? initialNote.columns
        : [{ id: uuid(), name: "", color: KANBAN_COLUMN_COLORS[0], items: [] }],
  });

  const isNewlyCreated = note.createdAt === note.updatedAt;

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

  /* Card movement for drag provider */

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
        </View>

        <View style={styles.boardContainer}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KanbanDragProvider
              columns={note.columns}
              onMoveCard={moveCard}
              onReorderCards={reorderCards}
              scrollViewRef={scrollViewRef}
              columnWidth={columnWidth}
              columnGap={PADDING_MARGIN.md}
            >
              <KanbanBoard
                note={note}
                setNoteAsync={setNoteAsync}
                columnWidth={columnWidth}
                snapInterval={snapInterval}
                scrollViewRef={scrollViewRef}
              />
            </KanbanDragProvider>
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
  boardContainer: {
    flex: 1,
    marginTop: PADDING_MARGIN.lg,
  },
});
