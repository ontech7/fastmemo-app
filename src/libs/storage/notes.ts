import FSStorage from "@/libs/storage/fsStorage";
import { createNoteStore } from "@/libs/storage/noteStore";
import { createNoteStoreBackend } from "@/libs/storage/noteStoreBackend";
import * as Sentry from "@sentry/react-native";

/*
 * The app's note store (ADR-018), in its own module: store.ts persists the notes with it, and the wipe thunk removes
 * the notes' other copies with it (the thunks can't import store.ts, which imports the slices).
 */

let sortNeeded = false;

/** One stored value per note: a save writes only the notes that changed. */
export const noteStore = FSStorage()
  ? createNoteStore(createNoteStoreBackend(), {
      report: (message, detail) => {
        console.warn(message, detail ?? "");
        Sentry.captureMessage(message, { level: "warning", extra: { detail } });
      },
      onSortNeeded: () => {
        sortNeeded = true;
      },
    })
  : null;

/** Whether the notes read at launch aren't in their stored order (to be sorted once rehydrated). */
export const notesNeedSorting = (): boolean => sortNeeded;
