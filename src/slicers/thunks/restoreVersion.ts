import { createAsyncThunk } from "@reduxjs/toolkit";

import { notifyNoteChanged } from "@/libs/cloud/sync";
import { addTrail } from "@/libs/diagnostics";
import { keepVersion, readVersion } from "@/libs/history";
import { withBody } from "@/libs/history/limits";
import { flushPending } from "@/libs/registry";
import { addNote } from "@/slicers/notesSlice";
import { selectorWebhook_updateNote } from "@/slicers/settingsSlice";
import type { AppRootState } from "@/slicers/store";
import type { Note, RootState } from "@/types";
import { formatDateTime } from "@/utils/date";
import { noteWebhookBody } from "@/utils/noteWebhook";
import { webhook } from "@/utils/webhook";

/**
 * Puts a kept version's title and content back in a note (spec B.9), as an ordinary edit: the editors' pending edits are
 * committed first, the note as it is now is kept ("restore"), then `addNote` stamps a revision and queues the upload, an
 * open editor reloads, and the "note updated" webhook fires. Flags and category stay as they are now. Resolves to false,
 * changing nothing, when the note is gone or in the trash, read only, or the version can't be read or is of another type.
 */
export const restoreVersion = createAsyncThunk<boolean, { noteId: string; versionId: string }, { state: AppRootState }>(
  "notes/restoreVersion",
  async ({ noteId, versionId }, { dispatch, getState }) => {
    flushPending();
    const body = await readVersion(noteId, versionId);
    const state = getState();
    const current = state.notes.items.find((note) => note.id === noteId);
    if (!body || !current || current.readOnly) return false;
    const restored = withBody(current, body);
    if (!restored) return false;

    keepVersion(current, "restore");
    const next = { ...restored, updatedAt: Math.max(Date.now(), current.updatedAt + 1), date: formatDateTime() } as Note;
    dispatch(addNote(next));
    notifyNoteChanged(noteId);
    webhook(selectorWebhook_updateNote(state as unknown as RootState), noteWebhookBody("note/updateNote", next));
    addTrail("history.restore", { type: current.type || "text" });
    return true;
  }
);
