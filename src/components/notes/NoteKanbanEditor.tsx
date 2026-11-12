import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import EditorTourTip from "@/components/notes/EditorTourTip";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, KANBAN_COLUMN_COLORS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName } from "@/libs/ai";
import { moveCard } from "@/libs/kanbanOps";
import ReorderProvider from "@/providers/ReorderProvider";
import { selectorAIAssistant, selectorWebhook_addKanbanNote } from "@/slicers/settingsSlice";
import type { KanbanNote } from "@/types";
import { isKanbanNoteEmpty } from "@/utils/noteEmpty";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

const COLUMN_PEEK = 40;

interface Props {
  initialNote: KanbanNote;
}

export default function NoteKanbanEditor({ initialNote }: Props) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const columnWidth = Math.min(screenWidth, 500) - PADDING_MARGIN.lg * 2 - COLUMN_PEEK;
  const snapInterval = columnWidth + PADDING_MARGIN.md;

  const memoInitialNote = useMemo<KanbanNote>(
    () => ({
      ...initialNote,
      type: initialNote.type || "kanban",
      columns:
        initialNote.columns?.length > 0
          ? initialNote.columns
          : [
              {
                id: uuid(),
                name: "",
                color: KANBAN_COLUMN_COLORS[0],
                items: [{ id: uuid(), text: "", createdAt: initialNote.createdAt }],
              },
            ],
    }),
    [initialNote]
  );
  const buildPayloadExtras = useCallback((n: KanbanNote) => ({ columns: n.columns }), []);

  // Only a brand-new note autofocuses its first card; opening an existing note
  // focuses nothing so the user can just read.
  const autofocus = useAutofocusNewNote(initialNote);
  const initialFocusCardId = useMemo(
    () => (autofocus ? (memoInitialNote.columns[0]?.items[0]?.id ?? null) : null),
    [autofocus, memoInitialNote]
  );

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle } = useNoteEditor<KanbanNote>({
    initialNote: memoInitialNote,
    defaultType: "kanban",
    addWebhookSelector: selectorWebhook_addKanbanNote,
    addAction: "note/addKanbanNote",
    isEmpty: isKanbanNoteEmpty,
    buildPayloadExtras,
    getTitleSource: (n) =>
      n.columns
        .flatMap((col) => col.items.map((item) => item.text))
        .filter(Boolean)
        .join(" "),
  });

  const aiSettings = useSelector(selectorAIAssistant);

  // The AI button is the only floating bottom action for now; the divider
  // follows whether it's actually shown.
  const showAiActions = aiSettings.enabled && aiSettings.modelDownloaded && !note.readOnly;

  /* Title */

  const setTitle = useCallback(
    (title: string) => updateNoteAsync((current) => (current.title === title ? current : { ...current, title })),
    [updateNoteAsync]
  );

  /* The drag */

  // The board as it is now, read by the drag at lift: a ref, so a keystroke doesn't render the drag's provider.
  const columnsRef = useRef(note.columns);
  useLayoutEffect(() => {
    columnsRef.current = note.columns;
  }, [note.columns]);

  // On the board as it is at the drop (it may have changed meanwhile, here or on another device): a move that can't
  // complete, or that changes nothing, commits nothing (LL-078).
  const onDrop = useCallback(
    (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => {
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const columns = moveCard(current.columns, cardId, fromColumnId, toColumnId, toIndex);
        return columns === current.columns ? current : { ...current, columns };
      });
    },
    [updateNoteAsync]
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
          </View>

          <View style={styles.boardContainer}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ReorderProvider containersRef={columnsRef} onDrop={onDrop}>
                <KanbanBoard
                  note={note}
                  updateNoteAsync={updateNoteAsync}
                  columnWidth={columnWidth}
                  snapInterval={snapInterval}
                  initialFocusCardId={initialFocusCardId}
                />
              </ReorderProvider>
            </GestureHandlerRootView>
          </View>

          {showAiActions && (
            <EditorActionDock>
              <View style={dockGroupStyle}>
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
                  categoryName={note.category.name}
                  onTitleGenerated={(title) => updateNoteAsync((current) => ({ ...current, title }))}
                  onCategorySuggested={(name) => {
                    const cat = findCategoryByName(name);
                    if (cat) updateNoteAsync((current) => ({ ...current, category: cat }));
                  }}
                  style={dockButtonStyle}
                  menuBottomOffset={110}
                />
              </View>
            </EditorActionDock>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <EditorTourTip />
    </View>
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
  boardContainer: {
    flex: 1,
    marginTop: PADDING_MARGIN.lg,
  },
});
