import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { Note } from "@/types";
import type { AppRootState } from "@/slicers/store";

import {
  COLLECTIONS,
  deleteCollectionInCloud,
  deleteElementInCloud,
  exclusiveQueueEntry,
  setElementInCloud,
  updateLastSyncInCloud,
} from "@/libs/firebase";

/**
 * Pure action that wipes all local notes (live + trash).
 * Declared here (not in notesSlice) so that wipeNotesThunk can dispatch it
 * without creating a require cycle between notesSlice and thunks/notes.
 * The reducer logic lives in notesSlice's `extraReducers`.
 */
export const wipeNotes = createAction("notes/wipe");

interface ProcessNotesParams {
  notes: Note[];
  deviceUuid: string;
  devicesToSync: string[];
  areMoreThanOneDevice: boolean;
  operation: "add" | "delete" | "detach";
}

interface CloudSyncParams {
  deviceUuid: string;
  devicesToSync: string[];
  areMoreThanOneDevice: boolean;
}

const NOTE_QUEUES = ["addNotes", "deleteNotes", "detachNotes"] as const;

const getTimestampedNote = (note: Note): Note => ({
  ...note,
  createdAt: note.createdAt ?? Date.now(),
  updatedAt: note.updatedAt ?? Date.now(),
});

const processNotes = async ({
  notes,
  deviceUuid,
  devicesToSync,
  areMoreThanOneDevice,
  operation,
}: ProcessNotesParams): Promise<Record<string, Note>> => {
  const results: Record<string, Note> = {};

  for (const note of notes) {
    let primaryDone = false;
    let secondaryDone = true;

    const payload = getTimestampedNote(note);

    if (operation === "add") {
      primaryDone = await setElementInCloud({
        collection: COLLECTIONS.data.notes,
        identifier: note.id,
        payload,
        noUpdateLastSync: true,
      });
    } else if (operation === "delete" || operation === "detach") {
      // detach also removes the note from the cloud; the difference is the
      // fan-out bucket below ("detachNotes"), which tells other devices to keep
      // their copy but mark it offline instead of trashing it
      primaryDone = await deleteElementInCloud({
        collection: COLLECTIONS.data.notes,
        identifier: note.id,
        noUpdateLastSync: true,
      });
    }

    if (areMoreThanOneDevice) {
      secondaryDone = await setElementInCloud({
        collection: COLLECTIONS.various.connectedDevices,
        identifier: deviceUuid,
        payload: {
          ...exclusiveQueueEntry(NOTE_QUEUES, `${operation}Notes`, note.id, payload),
          devicesToSync,
        },
        merge: true,
        noUpdateLastSync: true,
      });
    }

    if (primaryDone && secondaryDone) {
      results[note.id] = note;
    }
  }

  // Once per batch rather than after every write: it's only shown in the devices list.
  if (Object.keys(results).length > 0) await updateLastSyncInCloud();

  return results;
};

export const addCloudNotesAsync = createAsyncThunk<Record<string, Note>, CloudSyncParams, { state: AppRootState }>(
  "notes/addCloudNotesAsync",
  async ({ deviceUuid, devicesToSync, areMoreThanOneDevice }, thunkAPI) => {
    const { cloud } = thunkAPI.getState().notes;
    const notesToAdd = Object.values(cloud.items.add);

    return await processNotes({
      notes: notesToAdd,
      deviceUuid,
      devicesToSync,
      areMoreThanOneDevice,
      operation: "add",
    });
  }
);

export const deleteCloudNotesAsync = createAsyncThunk<Record<string, Note>, CloudSyncParams, { state: AppRootState }>(
  "notes/deleteCloudNotesAsync",
  async ({ deviceUuid, devicesToSync, areMoreThanOneDevice }, thunkAPI) => {
    const { cloud } = thunkAPI.getState().notes;
    const notesToDelete = Object.values(cloud.items.delete);

    return await processNotes({
      notes: notesToDelete,
      deviceUuid,
      devicesToSync,
      areMoreThanOneDevice,
      operation: "delete",
    });
  }
);

export const detachCloudNotesAsync = createAsyncThunk<Record<string, Note>, CloudSyncParams, { state: AppRootState }>(
  "notes/detachCloudNotesAsync",
  async ({ deviceUuid, devicesToSync, areMoreThanOneDevice }, thunkAPI) => {
    const { cloud } = thunkAPI.getState().notes;
    const notesToDetach = Object.values(cloud.items.detach);

    return await processNotes({
      notes: notesToDetach,
      deviceUuid,
      devicesToSync,
      areMoreThanOneDevice,
      operation: "detach",
    });
  }
);

/**
 * Wipes all local notes and, when requested, the corresponding cloud
 * collection. Dispatches the pure `wipeNotes` action first so the local state
 * is cleared immediately, then performs the async cloud deletion side effect
 * outside of the reducer.
 */
export const wipeNotesThunk = createAsyncThunk<void, { wipeCloud: boolean }, { state: AppRootState }>(
  "notes/wipeNotesThunk",
  async ({ wipeCloud }, { dispatch }) => {
    dispatch(wipeNotes());

    if (wipeCloud) {
      await deleteCollectionInCloud(COLLECTIONS.data.notes);
    }
  }
);
