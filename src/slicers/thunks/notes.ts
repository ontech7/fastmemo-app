import { createAsyncThunk } from "@reduxjs/toolkit";

import type { Note } from "@/types";
import type { AppRootState } from "@/slicers/store";

import { COLLECTIONS, deleteElementInCloud, setElementInCloud } from "@/libs/firebase";

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
