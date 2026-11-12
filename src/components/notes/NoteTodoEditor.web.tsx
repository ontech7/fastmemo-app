import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import EditorTourTip from "@/components/notes/EditorTourTip";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton.web";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { useTodoList } from "@/hooks/useTodoList";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, LIFT, PADDING_MARGIN, SHADOW, SIZE } from "@/constants/styles";

import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import TodoModeMenuButton from "@/components/notes/TodoModeMenuButton";
import TodoItem, { TodoItemLifted } from "@/components/todo/TodoItem.web";

import type { TodoNote } from "@/types";

interface Props {
  initialNote: TodoNote;
}

// Module-level: a new options object at each render makes new sensors, which change dnd-kit's context and render every
// row again.
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };
// The drop lands quickly, as on the board (LIFT.dropMs): moving many rows in a row must not wait on it.
const DROP_ANIMATION = { duration: LIFT.dropMs, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };

export default function NoteTodoEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS));

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
    moveItem,
    addSuggestedItems,
    insertVoiceLines,
    setTitleFromAI,
    setCategoryFromAI,
  } = useTodoList(initialNote);

  const currentMode = stepMode ? "steps" : "free";

  // The same array while the order doesn't change: a new one changes dnd-kit's sortable context, which renders every
  // row again whatever `memo` says.
  const idsKey = note.list.map((item) => item.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids, not on the list
  const itemIds = useMemo(() => note.list.map((item) => item.id), [idsKey]);

  // The row in the air is drawn by the overlay, lifted like a kanban card; its place in the list shows the slot.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeItem = activeId ? note.list.find((item) => item.id === activeId) : undefined;
  const handleDragStart = useCallback(({ active }: DragStartEvent) => setActiveId(String(active.id)), []);
  const handleDragCancel = useCallback(() => setActiveId(null), []);
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (over && active.id !== over.id) moveItem(String(active.id), String(over.id));
    },
    [moveItem]
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
          paddingVertical: PADDING_MARGIN.lg,
        }}
      >
        <ScrollView style={styles.draggableList}>
          {note.list.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
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
                      setText={setItemText}
                      checkItem={checkItem}
                      deleteItem={deleteItem}
                      disabled={note.readOnly}
                      autoFocus={item.id === focusId}
                      stepMode={stepMode}
                      stepStatus={stepStatus}
                      stepNumber={stepMode ? index + 1 : undefined}
                      isFirst={index === 0}
                      isLast={index === total - 1}
                    />
                  );
                })}
              </SortableContext>
              {/* On the page itself: react-native-web's ScrollView has a transform, which would place the overlay's
                  `position: fixed` (and the box dnd-kit measures for the drop) relative to the list instead. */}
              {typeof document !== "undefined" &&
                createPortal(
                  <DragOverlay dropAnimation={DROP_ANIMATION}>
                    {activeItem ? <TodoItemLifted item={activeItem} /> : null}
                  </DragOverlay>,
                  document.body
                )}
            </DndContext>
          ) : (
            <Text style={styles.noItems}>{t("note.no_items")}</Text>
          )}
        </ScrollView>
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
  draggableList: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.xl,
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
