import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import EditorTourTip from "@/components/notes/EditorTourTip";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton.web";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { useTodoList } from "@/hooks/useTodoList";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import TodoModeMenuButton from "@/components/notes/TodoModeMenuButton";
import TodoItem from "@/components/todo/TodoItem";
import TodoList, { type RowDrag } from "@/components/todo/TodoList";

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
    moveItemTo,
    addSuggestedItems,
    insertVoiceLines,
    setTitleFromAI,
    setCategoryFromAI,
  } = useTodoList(initialNote);

  const currentMode = stepMode ? "steps" : "free";

  // `drag` changes only while a row is in the air (ADR-038); a keystroke renders the row that changed.
  const renderRow = useCallback(
    (item: TodoItemType, index: number, drag: RowDrag) => {
      const stepStatus: "done" | "ongoing" | "future" = item.checked
        ? "done"
        : index === firstUncheckedIndex
          ? "ongoing"
          : "future";

      return (
        <TodoItem
          key={item.id}
          item={item}
          setText={setItemText}
          checkItem={checkItem}
          deleteItem={deleteItem}
          disabled={note.readOnly}
          folded={drag.folded}
          slotHeight={drag.slotHeight}
          autoFocus={item.id === focusId}
          stepMode={stepMode}
          stepStatus={stepStatus}
          stepNumber={stepMode ? index + 1 : undefined}
          isFirst={index === 0}
          isLast={index === total - 1}
        />
      );
    },
    [firstUncheckedIndex, focusId, stepMode, total, note.readOnly, setItemText, checkItem, deleteItem]
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

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

      <View
        style={{
          flex: 1,
          position: "relative",
          maxWidth: 800,
          width: SIZE.full,
          marginHorizontal: "auto",
        }}
      >
        {note.list.length > 0 ? (
          <TodoList list={note.list} renderRow={renderRow} moveItemTo={moveItemTo} />
        ) : (
          <Text style={styles.noItems}>{t("note.no_items")}</Text>
        )}
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

            <VoiceRecognitionButton onInsert={insertVoiceLines} aiCleanup style={dockButtonStyle} />
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

      <EditorTourTip />
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
