import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import SafeAreaView from "@/components/SafeAreaView";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, KANBAN_COLUMN_COLORS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName } from "@/libs/ai";
import KanbanDragProvider from "@/providers/KanbanDragProvider";
import { selectorWebhook_addKanbanNote } from "@/slicers/settingsSlice";
import type { KanbanItem, KanbanNote } from "@/types";
import { isStringEmpty } from "@/utils/string";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import uuid from "react-uuid";
import KanbanBoard from "../kanban/KanbanBoard";

const COLUMN_PEEK = 40;

interface Props {
  initialNote: KanbanNote;
}

const isKanbanNoteEmpty = (n: KanbanNote) => {
  const no_title = isStringEmpty(n.title);
  const no_columns = !n.columns?.length;
  const no_cards = n.columns?.every((col) => !col.items?.length);
  return no_title && (no_columns || no_cards);
};

export default function NoteKanbanEditor({ initialNote }: Props) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const columnWidth = Math.min(screenWidth, 500) - PADDING_MARGIN.lg * 2 - COLUMN_PEEK;
  const snapInterval = columnWidth + PADDING_MARGIN.md;

  const scrollViewRef = useRef(null);

  const memoInitialNote = useMemo<KanbanNote>(
    () => ({
      ...initialNote,
      type: initialNote.type || "kanban",
      columns:
        initialNote.columns?.length > 0
          ? initialNote.columns
          : [{ id: uuid(), name: "", color: KANBAN_COLUMN_COLORS[0], items: [] }],
    }),
    [initialNote]
  );
  const buildPayloadExtras = useCallback((n: KanbanNote) => ({ columns: n.columns }), []);

  const { note, setNoteAsync, updateNoteWebhook } = useNoteEditor<KanbanNote>({
    initialNote: memoInitialNote,
    defaultType: "kanban",
    addWebhookSelector: selectorWebhook_addKanbanNote,
    addAction: "note/addKanbanNote",
    isEmpty: isKanbanNoteEmpty,
    buildPayloadExtras,
  });

  /* Title */

  const setTitle = useCallback(
    (titleVal: string) => {
      setNoteAsync({ ...note, title: titleVal });
    },
    [note, setNoteAsync]
  );

  /* Card movement for drag provider */

  const moveCard = useCallback(
    (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => {
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
    (columnId: string, newItems: KanbanItem[]) => {
      const columns = note.columns.map((col) => {
        if (col.id !== columnId) return col;
        return { ...col, items: newItems };
      });
      setNoteAsync({ ...note, columns });
    },
    [note, setNoteAsync]
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

          {!note.readOnly && (
            <AIEditorActions
              noteType="kanban"
              getContent={() =>
                note.columns
                  .map((col) => {
                    const cards = col.items
                      .map((item) => item.text)
                      .filter(Boolean)
                      .join(", ");
                    return cards ? `${col.name}: ${cards}` : col.name;
                  })
                  .filter(Boolean)
                  .join(". ")
              }
              noteTitle={note.title}
              onTitleGenerated={(title) => setNoteAsync({ ...note, title })}
              onCategorySuggested={(name) => {
                const cat = findCategoryByName(name);
                if (cat) setNoteAsync({ ...note, category: cat });
              }}
              style={{ bottom: 20 }}
              menuBottomOffset={120}
            />
          )}
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
