import { useCallback, useMemo, useState } from "react";
import uuid from "react-uuid";

import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName } from "@/libs/ai";
import { selectorWebhook_addTodoNote } from "@/slicers/settingsSlice";
import { isTodoNoteEmpty } from "@/utils/noteEmpty";
import { capitalize } from "@/utils/string";
import { voiceTextToLines } from "@/utils/voiceTranscript";

import type { TodoItem, TodoNote } from "@/types";

/*
 * The state and the actions of a list note, shared by the native and the web editor. Every action computes from the
 * note as it is when it runs (`updateNoteAsync((current) => …)`), never from the rendered one, so none of them depends
 * on the note: they stay the same functions for the life of the editor, and a row that didn't change isn't rendered
 * again (LL-018, LL-020). An action that has nothing to do returns `current` itself (nothing is committed). An item that
 * doesn't change keeps its object, so its row doesn't render either.
 */

const buildPayloadExtras = (n: TodoNote) => ({ list: n.list, mode: n.mode });

const getTitleSource = (n: TodoNote) =>
  n.list
    .map((item) => item.text)
    .filter(Boolean)
    .join(" ");

const newItem = (text = ""): TodoItem => ({ id: uuid(), text, checked: false });

export function useTodoList(initialNote: TodoNote) {
  const memoInitialNote = useMemo<TodoNote>(
    () => ({
      ...initialNote,
      type: initialNote.type || "todo",
      list: initialNote.list?.length > 0 ? initialNote.list : [newItem()],
    }),
    [initialNote]
  );

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle } = useNoteEditor<TodoNote>({
    initialNote: memoInitialNote,
    defaultType: "todo",
    addWebhookSelector: selectorWebhook_addTodoNote,
    addAction: "note/addTodoNote",
    isEmpty: isTodoNoteEmpty,
    buildPayloadExtras,
    getTitleSource,
  });

  // Autofocus is per-row: only the row whose id matches `focusId` grabs focus. A brand-new note focuses its first row;
  // opening an existing note focuses nothing so the user can just read. `focusId` is seeded synchronously so the target
  // row mounts with autoFocus already set: setting it after mount is a no-op, the input reads `autoFocus` only once.
  const autofocus = useAutofocusNewNote(initialNote);
  const [focusId, setFocusId] = useState<string | null>(autofocus ? (memoInitialNote.list[0]?.id ?? null) : null);

  const stepMode = note.mode === "steps";
  const firstUncheckedIndex = useMemo(() => note.list.findIndex((item) => !item.checked), [note.list]);
  const total = note.list.length;
  const done = useMemo(() => note.list.filter((item) => item.checked).length, [note.list]);

  const setTitle = useCallback(
    (title: string) => updateNoteAsync((current) => (current.title === title ? current : { ...current, title })),
    [updateNoteAsync]
  );

  const setItemText = useCallback(
    (id: string, text: string) =>
      updateNoteAsync((current) => {
        const index = current.list.findIndex((item) => item.id === id);
        if (index === -1 || current.list[index].text === text) return current;
        const list = [...current.list];
        list[index] = { ...list[index], text };
        return { ...current, list };
      }),
    [updateNoteAsync]
  );

  const checkItem = useCallback(
    (id: string) =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const index = current.list.findIndex((item) => item.id === id);
        if (index === -1) return current;

        if (current.mode === "steps") {
          // Stepper toggle: tapping an unchecked step completes it and every previous one; tapping a done step rolls
          // back: it and every step after become "not done" (so it turns ongoing). Re-tapping the first step therefore
          // returns to "nothing done / first ongoing". The steps whose state stays keep their object.
          const wasChecked = current.list[index].checked;
          const list = current.list.map((item, i) => {
            const checked = wasChecked ? i < index : i <= index;
            return item.checked === checked ? item : { ...item, checked };
          });
          return { ...current, list };
        }

        const list = [...current.list];
        list[index] = { ...list[index], checked: !list[index].checked };
        return { ...current, list };
      }),
    [updateNoteAsync]
  );

  const deleteItem = useCallback(
    (id: string) =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const list = current.list.filter((item) => item.id !== id);
        return list.length === current.list.length ? current : { ...current, list };
      }),
    [updateNoteAsync]
  );

  const addItem = useCallback(() => {
    const item = newItem();
    let added = false;
    updateNoteAsync((current) => {
      if (current.readOnly) return current;
      added = true;
      return { ...current, list: [...current.list, item] };
    });
    // Focus the freshly added row so the user can type without tapping it.
    if (added) setFocusId(item.id);
  }, [updateNoteAsync]);

  const setMode = useCallback(
    (mode: TodoNote["mode"]) => {
      let changed = false;
      updateNoteAsync((current) => {
        if (current.readOnly || current.mode === mode) return current;
        changed = true;
        return { ...current, mode };
      });
      // Switching mode remounts the rows; don't let their inputs grab focus.
      if (changed) setFocusId(null);
    },
    [updateNoteAsync]
  );

  const reorder = useCallback(
    (list: TodoItem[]) =>
      updateNoteAsync((current) => {
        if (current.readOnly || list.length !== current.list.length) return current;
        // The drag started from the list as it was: applied only if it holds the same items, each as it is now (an edit
        // that arrived meanwhile is kept).
        const byId = new Map(current.list.map((item) => [item.id, item]));
        if (!list.every((item) => byId.has(item.id))) return current;
        const next = list.map((item) => byId.get(item.id) as TodoItem);
        return next.every((item, i) => item === current.list[i]) ? current : { ...current, list: next };
      }),
    [updateNoteAsync]
  );

  const moveItem = useCallback(
    (fromId: string, toId: string) =>
      updateNoteAsync((current) => {
        if (current.readOnly || fromId === toId) return current;
        const from = current.list.findIndex((item) => item.id === fromId);
        const to = current.list.findIndex((item) => item.id === toId);
        if (from === -1 || to === -1) return current;
        const list = [...current.list];
        list.splice(to, 0, list.splice(from, 1)[0]);
        return { ...current, list };
      }),
    [updateNoteAsync]
  );

  const addSuggestedItems = useCallback(
    (texts: string[]) => {
      if (texts.length === 0) return;
      const items = texts.map((text) => newItem(capitalize(text)));
      updateNoteAsync((current) => ({ ...current, list: [...current.list, ...items] }));
    },
    [updateNoteAsync]
  );

  const insertVoiceLines = useCallback(
    (text: string) => {
      const lines = voiceTextToLines(text);
      if (lines.length === 0) return;
      const items = lines.map((line) => newItem(line));
      updateNoteAsync((current) => {
        const list = [...current.list];
        const last = list[list.length - 1];
        // A trailing empty item takes the first dictated line.
        if (last && !last.text.trim()) {
          list[list.length - 1] = { ...last, text: lines[0] };
          return { ...current, list: [...list, ...items.slice(1)] };
        }
        return { ...current, list: [...list, ...items] };
      });
    },
    [updateNoteAsync]
  );

  const setTitleFromAI = useCallback(
    (title: string) => updateNoteAsync((current) => ({ ...current, title })),
    [updateNoteAsync]
  );

  const setCategoryFromAI = useCallback(
    (name: string) => {
      const category = findCategoryByName(name);
      if (category) updateNoteAsync((current) => ({ ...current, category }));
    },
    [updateNoteAsync]
  );

  return {
    note,
    setNoteAsync,
    flushNote,
    updateNoteWebhook,
    autoTitle,
    autofocus,
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
    reorder,
    moveItem,
    addSuggestedItems,
    insertVoiceLines,
    setTitleFromAI,
    setCategoryFromAI,
  };
}
