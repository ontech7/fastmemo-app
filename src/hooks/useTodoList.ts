import { useCallback, useMemo, useRef, useState } from "react";
import uuid from "react-uuid";

import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName } from "@/libs/ai";
import { doneCount, freshAfter, insertAfter, moveVisibleTo, removeItem, visibleItems, withoutDone } from "@/libs/listOps";
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

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle, keepVersion } = useNoteEditor<TodoNote>(
    {
      initialNote: memoInitialNote,
      defaultType: "todo",
      addWebhookSelector: selectorWebhook_addTodoNote,
      addAction: "note/addTodoNote",
      isEmpty: isTodoNoteEmpty,
      buildPayloadExtras,
      getTitleSource,
    }
  );

  // Autofocus is per-row: only the row whose id matches `focusId` grabs focus. A brand-new note focuses its first row;
  // opening an existing note focuses nothing so the user can just read. `focusId` is seeded synchronously so the target
  // row mounts with autoFocus already set: setting it after mount is a no-op, the input reads `autoFocus` only once.
  // `focusSeq` changes with every request, so a row already focused once (the one above an emptied row) takes it again.
  const autofocus = useAutofocusNewNote(initialNote);
  const focusSeqRef = useRef(0);
  const [focus, setFocus] = useState<{ id: string; seq: number } | null>(() =>
    autofocus && memoInitialNote.list[0] ? { id: memoInitialNote.list[0].id, seq: 0 } : null
  );
  const focusRow = useCallback((id: string | null) => setFocus(id ? { id, seq: ++focusSeqRef.current } : null), []);
  const focusId = focus?.id ?? null;
  const focusSeq = focus?.seq ?? 0;

  const stepMode = note.mode === "steps";
  // A read-only list draws everything: its "Show" couldn't change the note, and none of the list's tools apply to it.
  const hideDone = !!note.hideDone && !note.readOnly;
  // What the editor draws: the done items left out while they are hidden. The counter still counts them all.
  const visible = useMemo(() => visibleItems(note.list, hideDone), [note.list, hideDone]);
  const firstUncheckedId = useMemo(() => note.list.find((item) => !item.checked)?.id ?? null, [note.list]);
  // A step's number is its place in the whole list, hidden steps counted.
  const positionOf = useMemo(() => new Map(note.list.map((item, index) => [item.id, index])), [note.list]);
  const total = note.list.length;
  const done = useMemo(() => doneCount(note.list), [note.list]);
  const hiddenCount = hideDone ? done : 0;

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
    if (added) focusRow(item.id);
  }, [updateNoteAsync, focusRow]);

  // Enter in an item: a new empty item right under it, which takes the focus (the text is never split).
  const lastAddedRef = useRef<{ after: string; id: string } | null>(null);
  const addItemAfter = useCallback(
    (id: string) => {
      const item = newItem();
      let focusTo: string | null = null;
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const last = lastAddedRef.current;
        // The same Enter a second time (Android's hardware key submits on down and on up): the item it made takes the caret.
        if (last?.after === id && freshAfter(current.list, id, last.id)) {
          focusTo = last.id;
          return current;
        }
        focusTo = item.id;
        return { ...current, list: insertAfter(current.list, id, item) };
      });
      if (focusTo === item.id) lastAddedRef.current = { after: id, id: item.id };
      if (focusTo) focusRow(focusTo);
    },
    [updateNoteAsync, focusRow]
  );

  // Backspace in an empty item: it goes, the caret to the end of the nearest visible item above (below for the first).
  // The only item of a list stays.
  const removeEmptyItem = useCallback(
    (id: string) => {
      let focusTo: string | null = null;
      updateNoteAsync((current) => {
        if (current.readOnly || current.list.find((item) => item.id === id)?.text !== "") return current;
        const removed = removeItem(current.list, id, !!current.hideDone);
        if (removed.list.length === current.list.length) return current;
        focusTo = removed.focusId;
        return { ...current, list: removed.list };
      });
      if (focusTo) focusRow(focusTo);
    },
    [updateNoteAsync, focusRow]
  );

  // A field of the note, like the mode: it gets a revision and syncs.
  const setHideDone = useCallback(
    (hide: boolean) =>
      updateNoteAsync((current) =>
        current.readOnly || !!current.hideDone === hide ? current : { ...current, hideDone: hide }
      ),
    [updateNoteAsync]
  );

  // The done items removed in one edit (the editor asks first).
  const deleteDone = useCallback(() => {
    // the list before it is kept as a version (spec B.9)
    keepVersion("cleanup");
    updateNoteAsync((current) => {
      if (current.readOnly) return current;
      const list = withoutDone(current.list);
      return list.length === current.list.length ? current : { ...current, list };
    });
  }, [updateNoteAsync, keepVersion]);

  const setMode = useCallback(
    (mode: TodoNote["mode"]) => {
      let changed = false;
      updateNoteAsync((current) => {
        if (current.readOnly || current.mode === mode) return current;
        changed = true;
        return { ...current, mode };
      });
      // Switching mode remounts the rows; don't let their inputs grab focus.
      if (changed) focusRow(null);
    },
    [updateNoteAsync, focusRow]
  );

  // A drop or a keyboard move, applied to the list as it is now (by id: a row deleted meanwhile, here or on another
  // device, moves nothing). `toIndex` counts the row where it still is (moveById), among the rows drawn: with the done
  // ones hidden, they keep their places.
  const moveItemTo = useCallback(
    (itemId: string, toIndex: number) =>
      updateNoteAsync((current) => {
        if (current.readOnly) return current;
        const list = moveVisibleTo(current.list, itemId, toIndex, !!current.hideDone);
        return list === current.list ? current : { ...current, list };
      }),
    [updateNoteAsync]
  );

  const addSuggestedItems = useCallback(
    (texts: string[]) => {
      if (texts.length === 0) return;
      const items = texts.map((text) => newItem(capitalize(text)));
      // the list before the AI's items is kept as a version (spec B.9)
      keepVersion("ai");
      updateNoteAsync((current) => ({ ...current, list: [...current.list, ...items] }));
    },
    [updateNoteAsync, keepVersion]
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
    focusSeq,
    stepMode,
    firstUncheckedId,
    positionOf,
    total,
    done,
    hideDone,
    visible,
    hiddenCount,
    setTitle,
    setItemText,
    checkItem,
    deleteItem,
    addItem,
    addItemAfter,
    removeEmptyItem,
    setHideDone,
    deleteDone,
    setMode,
    moveItemTo,
    addSuggestedItems,
    insertVoiceLines,
    setTitleFromAI,
    setCategoryFromAI,
  };
}
