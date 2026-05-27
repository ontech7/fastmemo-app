import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import type { Category, Note, NoteFilters, NotesState, RootState } from "@/types";

import { retrieveDirtyNoteId } from "@/libs/registry";

import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import { only_if_cloudConnected } from "@/libs/firebase";
import { getDEK, isVaultUnlocked } from "@/libs/vaultSession";
import { CryptNote, tryDecryptNote } from "@/utils/crypt";
import { createdAt_asc_sort } from "@/utils/sort";
import { addCloudNotesAsync, deleteCloudNotesAsync, detachCloudNotesAsync, wipeNotes } from "./thunks/notes";

const initialState: NotesState = {
  items: [],
  temporaryItems: [],
  temporaryTrashTimespan: configs.notes.daysToDelete,
  cloud: {
    items: {
      add: {},
      delete: {},
      detach: {},
    },
  },
  filters: {
    sortBy: "createdAt",
    order: "desc",
  },
};

/**
 * Queue a note for cloud upload — unless it is an offline (device-only) note.
 * Gated on an unlocked vault: with the vault locked we cannot encrypt, so we
 * skip queueing rather than leak plaintext. Such notes are picked up by the
 * full resync that runs right after the vault is unlocked on connect.
 */
const queueCloudAdd = (state: NotesState, note: Note): void => {
  if (note.local) return;
  only_if_cloudConnected(() => {
    if (!isVaultUnlocked()) return;
    state.cloud.items.add[note.id] = CryptNote.encrypt(note);
  });
};

/**
 * A delete/detach only needs the note id downstream (deleteElementInCloud by id,
 * and consumers read only `id`). So we queue a content-stripped stub instead of
 * an encrypted note: it needs no DEK (works even while the vault is locked) and
 * never leaks plaintext content into the cloud fan-out doc.
 */
const deletionStub = (note: Note): Note => {
  const stub = { ...note } as Record<string, unknown>;
  delete stub.text;
  delete stub.list;
  delete stub.columns;
  delete stub.tabs;
  return stub as unknown as Note;
};

/** Queue a note for cloud deletion — unless it is an offline (device-only) note. */
const queueCloudDelete = (state: NotesState, note: Note): void => {
  if (note.local) return;
  only_if_cloudConnected(() => {
    state.cloud.items.delete[note.id] = deletionStub(note);
  });
};

const sortNotes = (items: Note[], filters: NoteFilters): void => {
  items.sort((a, b) => {
    const field = filters?.sortBy || "createdAt";
    const order = filters?.order || "desc";

    if (!a[field] || !b[field]) {
      return 0;
    }

    if (a[field] < b[field]) return order === "asc" ? -1 : 1;
    if (a[field] > b[field]) return order === "asc" ? 1 : -1;
    return 0;
  });
};

const notesSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    addNote: (state, action: PayloadAction<Note>) => {
      const idx = state.items.findIndex((n) => n.id === action.payload.id);

      if (idx === -1) {
        if ((state.filters?.order ?? "desc") === "desc") {
          state.items.unshift(action.payload);
        } else {
          state.items.push(action.payload);
        }
      } else {
        state.items[idx] = action.payload;

        const dirtyId = retrieveDirtyNoteId();

        if (dirtyId === action.payload.id) {
          sortNotes(state.items, state.filters);
        }
      }

      queueCloudAdd(state, action.payload);
    },

    setNoteFilters: (state, action: PayloadAction<NoteFilters>) => {
      state.filters = action.payload;
    },

    reorderNotes: (state) => {
      sortNotes(state.items, state.filters);
    },

    changeNotesCategory: (state, action: PayloadAction<{ iconFrom: string; iconTo: string; nameTo: string }>) => {
      const { iconFrom, iconTo, nameTo } = action.payload;
      state.items.forEach((note) => {
        if (note.category.icon === iconFrom) {
          note.category.index = iconTo === "none";
          note.category.name = nameTo;
          note.category.icon = iconTo;
          queueCloudAdd(state, note);
        }
      });
    },

    changeNoteCategory: (state, action: PayloadAction<{ note: Note; iconTo: string; nameTo: string }>) => {
      const { note: targetNote, iconTo, nameTo } = action.payload;
      const found = state.items.find((n) => n.id === targetNote.id);
      if (found) {
        found.category.index = iconTo === "none";
        found.category.name = nameTo;
        found.category.icon = iconTo;
        queueCloudAdd(state, found);
      }
    },

    deleteNote: (state, action: PayloadAction<string>) => {
      state.temporaryItems = state.temporaryItems.filter((n) => n.id !== action.payload);
    },

    deleteSelectedNotes: (state, action: PayloadAction<{ selectedNotes: string[] }>) => {
      state.temporaryItems = state.temporaryItems.filter((n) => !action.payload.selectedNotes.includes(`${n.id}|${n.locked}`));
    },

    deleteAllNotes: (state) => {
      state.temporaryItems = [];
    },

    deleteNotesCategory: (state, action: PayloadAction<string>) => {
      const icon = action.payload;
      state.items = state.items.filter((note) => {
        if (note.category.icon !== icon) return true;

        const deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;
        note.deleteDate = deleteDate;
        state.temporaryItems.unshift(note);

        queueCloudDelete(state, note);
        return false;
      });
    },

    resetTrashedNotesCategory: (state, action: PayloadAction<string>) => {
      state.temporaryItems.forEach((note) => {
        if (note.category.icon === action.payload) {
          note.category = defaultCategory;
        }
      });
    },

    resetNotesCategory: (state, action: PayloadAction<string>) => {
      const icon = action.payload;
      state.items.forEach((note) => {
        if (note.category.icon === icon) {
          note.category = defaultCategory;
          queueCloudAdd(state, note);
        }
      });
    },

    restoreNote: (state, action: PayloadAction<{ id: string; categories: Category[] }>) => {
      const { id, categories } = action.payload;
      state.temporaryItems = state.temporaryItems.filter((note) => {
        if (note.id !== id) return true;

        delete note.deleteDate;
        if (!categories.some((c) => c.icon === note.category.icon)) {
          note.category = defaultCategory;
        }

        const idx = state.items.findIndex((n) => n.id === note.id);

        if (idx === -1) {
          state.items.unshift(note);
        } else {
          state.items[idx] = note;
        }

        sortNotes(state.items, state.filters);

        queueCloudAdd(state, note);
        return false;
      });
    },

    restoreSelectedTrashedNotes: (state, action: PayloadAction<{ selectedNotes: string[]; categories: Category[] }>) => {
      const { selectedNotes, categories } = action.payload;
      state.temporaryItems = state.temporaryItems.filter((note) => {
        if (!selectedNotes.includes(`${note.id}|${note.locked}`)) return true;

        delete note.deleteDate;
        if (!categories.some((c) => c.icon === note.category.icon)) {
          note.category = defaultCategory;
        }

        const idx = state.items.findIndex((n) => n.id === note.id);
        if (idx === -1) {
          state.items.unshift(note);
        } else {
          state.items[idx] = note;
        }

        queueCloudAdd(state, note);
        return false;
      });

      sortNotes(state.items, state.filters);
    },

    restoreAllTrashedNotes: (state, action: PayloadAction<{ categories: Category[] }>) => {
      const categories = action.payload.categories;
      state.temporaryItems.forEach((note) => {
        if (!categories.some((c) => c.icon === note.category.icon)) {
          note.category = defaultCategory;
        }
        delete note.deleteDate;

        const idx = state.items.findIndex((n) => n.id === note.id);
        if (idx === -1) {
          state.items.unshift(note);
        } else {
          state.items[idx] = note;
        }

        queueCloudAdd(state, note);
      });
      state.temporaryItems = [];

      sortNotes(state.items, state.filters);
    },

    setNotes: (state, action: PayloadAction<{ notes: Note[]; fromSync?: boolean }>) => {
      const { notes, fromSync } = action.payload;

      if (fromSync) {
        // never resurrect a note the user has trashed locally but whose cloud
        // deletion hasn't propagated yet (e.g. it was deleted while the vault was
        // locked, so the delete is still queued)
        const trashedIds = new Set(state.temporaryItems.map((n) => n.id));
        const incoming = notes.filter((n) => !trashedIds.has(n.id));

        // a cloud reconcile must never drop device-only notes: keep the local
        // ones that the incoming cloud set does not (and must not) contain
        const incomingIds = new Set(incoming.map((n) => n.id));
        const offlineOnly = state.items.filter((note) => note.local && !incomingIds.has(note.id));
        state.items = [...incoming, ...offlineOnly];
      } else {
        state.items = [...notes];
      }

      sortNotes(state.items, state.filters);

      if (!fromSync) {
        state.items.forEach((note) => queueCloudAdd(state, note));
      }
    },

    setTrashedNotes: (state, action: PayloadAction<Note[]>) => {
      state.temporaryItems = action.payload;
    },

    setTemporaryTrashTimespan: (state, action: PayloadAction<number>) => {
      state.temporaryTrashTimespan = action.payload;
    },

    temporaryDeleteNote: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.items = state.items.filter((note) => {
        if (note.id !== id) return true;

        note.deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;

        const idx = state.temporaryItems.findIndex((n) => n.id === note.id);
        if (idx === -1) {
          state.temporaryItems.unshift(note);
        } else {
          state.temporaryItems[idx] = note;
        }

        queueCloudDelete(state, note);
        return false;
      });
    },

    temporaryDeleteSelectedNotes: (state, action: PayloadAction<string[]>) => {
      state.items = state.items.filter((note) => {
        if (!action.payload.includes(`${note.id}|${note.locked}`)) return true;

        note.deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;

        const idx = state.temporaryItems.findIndex((n) => n.id === note.id);
        if (idx === -1) {
          state.temporaryItems.unshift(note);
        } else {
          state.temporaryItems[idx] = note;
        }

        queueCloudDelete(state, note);
        return false;
      });
    },

    toggleImportantNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.important = !note.important;
          queueCloudAdd(state, note);
        }
      });
    },

    toggleReadOnlyNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.readOnly = !note.readOnly;
          queueCloudAdd(state, note);
        }
      });
    },

    toggleHiddenNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.hidden = !note.hidden;
          queueCloudAdd(state, note);
        }
      });
    },

    toggleProtectedNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.locked = !note.locked;
          queueCloudAdd(state, note);
        }
      });
    },

    addLocalNotes: (state, action: PayloadAction<Record<string, Note>>) => {
      const dek = getDEK();
      if (!dek) return; // no key -> can't decrypt incoming notes; ignore until unlocked

      Object.values(action.payload)
        .sort(createdAt_asc_sort)
        .forEach((cloudNote) => {
          // skip notes we can't decrypt (encrypted under a different DEK): never
          // store ciphertext as plaintext, or the next edit re-encrypts garbage
          const note = tryDecryptNote(cloudNote, dek);
          if (!note) return;

          const idx = state.items.findIndex((n) => n.id === note.id);
          if (idx === -1) {
            state.items.unshift(note);
          } else {
            // never let a cloud/other-device copy overwrite a note that has
            // been detached (made offline) on this device
            if (state.items[idx].local) return;
            state.items[idx] = note;
          }
        });

      sortNotes(state.items, state.filters);
    },

    deleteLocalNotes: (state, action: PayloadAction<Record<string, Note>>) => {
      Object.values(action.payload).forEach((cloudNote) => {
        state.items = state.items.filter((localNote) => {
          if (localNote.id !== cloudNote.id) return true;
          // an offline note is owned by this device: ignore incoming deletions
          if (localNote.local) return true;

          localNote.deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;
          state.temporaryItems.unshift(localNote);
          return false;
        });
      });
    },

    /**
     * Detach a note from the cloud (synced -> offline). Marks it device-only and,
     * when connected, queues its removal from the cloud + a fan-out signal so other
     * devices mark their own copy offline the next time they sync.
     */
    detachNote: (state, action: PayloadAction<string>) => {
      const note = state.items.find((n) => n.id === action.payload);
      if (!note || note.local) return;

      // backfill the bucket for state persisted before this feature existed
      if (!state.cloud.items.detach) state.cloud.items.detach = {};

      // drop any pending upload before flipping the flag
      delete state.cloud.items.add[note.id];
      note.local = true;

      only_if_cloudConnected(() => {
        state.cloud.items.detach[note.id] = deletionStub(note);
      });
    },

    /**
     * Re-sync an offline note (offline -> synced). To avoid any overlap with stale
     * cloud/other-device versions it is published as a brand-new note: new id and a
     * " (2)" title suffix, so the user recognises it as a duplicate.
     */
    reattachNote: (state, action: PayloadAction<{ id: string; newId: string }>) => {
      const { id, newId } = action.payload;
      const idx = state.items.findIndex((n) => n.id === id);
      if (idx === -1) return;

      const now = Date.now();
      const reattached: Note = {
        ...state.items[idx],
        id: newId,
        title: `${state.items[idx].title ?? ""} (2)`.trim(),
        local: false,
        createdAt: now,
        updatedAt: now,
      };

      state.items[idx] = reattached;
      sortNotes(state.items, state.filters);

      queueCloudAdd(state, reattached);
    },

    /** Incoming fan-out: another device detached these notes; keep our copies but mark them offline. */
    detachLocalNotes: (state, action: PayloadAction<Record<string, Note>>) => {
      Object.values(action.payload).forEach((cloudNote) => {
        const note = state.items.find((n) => n.id === cloudNote.id);
        if (!note) return;
        note.local = true;
        delete state.cloud.items.add[note.id];
        delete state.cloud.items.delete[note.id];
      });
    },

    resetCloudNotes: (state) => {
      state.cloud.items.add = {};
      state.cloud.items.delete = {};
      state.cloud.items.detach = {};
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(addCloudNotesAsync.fulfilled, (state, action: PayloadAction<Record<string, Note>>) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.add[id];
        });
      })
      .addCase(deleteCloudNotesAsync.fulfilled, (state, action: PayloadAction<Record<string, Note>>) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.delete[id];
        });
      })
      .addCase(detachCloudNotesAsync.fulfilled, (state, action: PayloadAction<Record<string, Note>>) => {
        if (!state.cloud.items.detach) return;
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.detach[id];
        });
      })
      .addCase(wipeNotes, (state) => {
        state.items = [];
        state.temporaryItems = [];
      });
  },
});

// Actions
export const {
  addNote,
  setNoteFilters,
  reorderNotes,
  changeNotesCategory,
  changeNoteCategory,
  deleteNote,
  deleteSelectedNotes,
  deleteAllNotes,
  deleteNotesCategory,
  resetNotesCategory,
  resetTrashedNotesCategory,
  restoreNote,
  restoreSelectedTrashedNotes,
  restoreAllTrashedNotes,
  setNotes,
  setTrashedNotes,
  setTemporaryTrashTimespan,
  temporaryDeleteNote,
  temporaryDeleteSelectedNotes,
  toggleImportantNotes,
  toggleReadOnlyNotes,
  toggleHiddenNotes,
  toggleProtectedNotes,
  addLocalNotes,
  deleteLocalNotes,
  detachNote,
  reattachNote,
  detachLocalNotes,
  resetCloudNotes,
} = notesSlice.actions;

// Selectors
export const getNote =
  (id: string) =>
  (state: RootState): Note | undefined =>
    state.notes.items.find((note) => note.id === id);
export const getAllNotes = (state: RootState): Note[] => state.notes.items;
export const getAllTrashedNotes = (state: RootState): Note[] => state.notes.temporaryItems;
export const getCloudNotes = (state: RootState): NotesState["cloud"]["items"] => state.notes.cloud.items;
export const getTemporaryTrashTimespan = (state: RootState): number => state.notes.temporaryTrashTimespan;
export const getNoteFilters = (state: RootState): NoteFilters =>
  state.notes.filters || {
    sortBy: "createdAt",
    order: "desc",
  };

export const getNotesFilteredPerCategory = (currentCategory: Category, showHidden: boolean) =>
  createSelector([getAllNotes], (notes): Note[] => {
    return notes.reduce<Note[]>((acc, note) => {
      if (!currentCategory.index && note.category.icon !== currentCategory.icon) return acc;
      if (!showHidden && note.hidden) return acc;
      return note.important ? [note, ...acc] : [...acc, note];
    }, []);
  });

export const getNotesSizePerCategory = (category: Category) =>
  createSelector([getAllNotes], (notes): number => {
    return notes.filter((note) => category.index || note.category.icon === category.icon).length;
  });

export const getTrashedNotesFilteredPerCategory = (showHidden: boolean) =>
  createSelector([getAllTrashedNotes], (notes): Note[] => {
    return notes.reduce<Note[]>((acc, note) => {
      if (!showHidden && note.hidden) return acc;
      return note.important ? [note, ...acc] : [...acc, note];
    }, []);
  });

export default notesSlice.reducer;
