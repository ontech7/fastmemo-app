import { createAsyncThunk } from "@reduxjs/toolkit";
import uuid from "react-uuid";

import { addTrail } from "@/libs/diagnostics";
import { copyOfNote } from "@/libs/noteCopy";
import { addNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_addCodeNote,
  selectorWebhook_addKanbanNote,
  selectorWebhook_addTextNote,
  selectorWebhook_addTodoNote,
} from "@/slicers/settingsSlice";
import type { AppRootState } from "@/slicers/store";
import type { Note, NoteType, RootState } from "@/types";
import { formatDateTime } from "@/utils/date";
import { webhook } from "@/utils/webhook";

/** The "note added" webhook a new note of each type fires. */
const ADD_WEBHOOKS: Record<NoteType, { action: string; select: (state: RootState) => any }> = {
  text: { action: "note/addTextNote", select: selectorWebhook_addTextNote },
  todo: { action: "note/addTodoNote", select: selectorWebhook_addTodoNote },
  kanban: { action: "note/addKanbanNote", select: selectorWebhook_addKanbanNote },
  code: { action: "note/addCodeNote", select: selectorWebhook_addCodeNote },
};

/** What the editors send the user's webhook for a new note: its fields, and the content of its type. */
function addedBody(action: string, note: Note): Record<string, unknown> {
  const content =
    note.type === "todo"
      ? { list: note.list, mode: note.mode }
      : note.type === "kanban"
        ? { columns: note.columns }
        : note.type === "code"
          ? { tabs: note.tabs, activeTabId: note.activeTabId }
          : { text: note.text };
  return {
    action,
    id: note.id,
    type: note.type,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    important: note.important,
    readOnly: note.readOnly,
    hidden: note.hidden,
    locked: note.locked,
    category: { iconId: note.category?.icon, name: note.category?.name },
    ...content,
  };
}

/**
 * Adds a copy of a live note (spec A.4) through `addNote`, which gives it its place, a revision and the upload queue
 * (nothing for an offline note), and fires the "note added" webhook of its type. Resolves to the copy's id, or null when
 * there is nothing to copy. The caller commits the editor's pending edits first (`flushNote`).
 */
export const duplicateNote = createAsyncThunk<string | null, string, { state: AppRootState }>(
  "notes/duplicateNote",
  async (noteId, { dispatch, getState }) => {
    const state = getState();
    const original = state.notes.items.find((note) => note.id === noteId);
    if (!original) return null;

    const now = Date.now();
    const copy = copyOfNote(original, { id: uuid(), now, date: formatDateTime(), newId: uuid });
    if (!copy) return null;

    dispatch(addNote(copy));
    const type = (copy.type || "text") as NoteType;
    const added = ADD_WEBHOOKS[type];
    webhook(added.select(state as unknown as RootState), addedBody(added.action, copy));
    addTrail("note.duplicate", { type });
    return copy.id;
  }
);
