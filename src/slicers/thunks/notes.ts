import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { AppRootState } from "@/slicers/store";

import { cloud } from "@/libs/cloud";
import { noteStore } from "@/libs/storage/notes";

/**
 * Pure action that wipes all local notes (live + trash).
 * Declared here (not in notesSlice) so that wipeNotesThunk can dispatch it
 * without creating a require cycle between notesSlice and thunks/notes.
 * The reducer logic lives in notesSlice's `extraReducers`.
 */
export const wipeNotes = createAction("notes/wipe");

/**
 * Wipes all local notes and, when requested, the corresponding cloud
 * collection. Dispatches the pure `wipeNotes` action first so the local state
 * is cleared immediately, then performs the async side effects outside of the
 * reducer: the notes' other copies on this device (kept for a rollback or a
 * recovery, ADR-018) are removed, then the cloud's.
 */
export const wipeNotesThunk = createAsyncThunk<void, { wipeCloud: boolean }, { state: AppRootState }>(
  "notes/wipeNotesThunk",
  async ({ wipeCloud }, { dispatch }) => {
    dispatch(wipeNotes());
    await noteStore?.removeCopies();

    if (wipeCloud) {
      await cloud.wipeNotes();
    }
  }
);
