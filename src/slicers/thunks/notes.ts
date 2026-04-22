import { createAsyncThunk } from "@reduxjs/toolkit";

import type { Note } from "@/types";
import type { AppRootState } from "@/slicers/store";

import { COLLECTIONS, deleteCollectionInCloud, deleteElementInCloud, setElementInCloud } from "@/libs/firebase";

import { wipeNotes } from "@/slicers/notesSlice";

interface ProcessNotesParams {
  notes: Note[];
  deviceUuid: string;
  devicesToSync: string[];
  areMoreThanOneDevice: boolean;
  operation: "add" | "delete";
}

interface CloudSyncParams {
  deviceUuid: string;
  devicesToSync: string[];
  areMoreThanOneDevice: boolean;
}

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
      });
    } else if (operation === "delete") {
      primaryDone = await deleteElementInCloud({
        collection: COLLECTIONS.data.notes,
        identifier: note.id,
      });
    }

    if (areMoreThanOneDevice) {
      secondaryDone = await setElementInCloud({
        collection: COLLECTIONS.various.connectedDevices,
        identifier: deviceUuid,
        payload: {
          [`${operation}Notes`]: {
            [note.id]: payload,
          },
          devicesToSync,
        },
        merge: true,
      });
    }

    if (primaryDone && secondaryDone) {
      results[note.id] = note;
    }
  }

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
