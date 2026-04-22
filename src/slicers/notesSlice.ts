import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import type { Category, Note, NoteFilters, NotesState, RootState } from "@/types";

import { retrieveDirtyNoteId } from "@/libs/registry";

import { configs } from "../configs";
import { defaultCategory } from "../configs/default";
import { only_if_cloudConnected } from "../libs/firebase";
import { CryptNote } from "../utils/crypt";
import { createdAt_asc_sort } from "../utils/sort";
import { addCloudNotesAsync, deleteCloudNotesAsync, wipeNotes } from "./thunks/notes";

const initialState: NotesState = {
  items: [],
  temporaryItems: [],
  temporaryTrashTimespan: configs.notes.daysToDelete,
  cloud: {
    items: {
      add: {},
      delete: {},
    },
  },
  filters: {
    sortBy: "createdAt",
    order: "desc",
  },
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

      only_if_cloudConnected(() => {
        state.cloud.items.add[action.payload.id] = CryptNote.encrypt(action.payload);
      });
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
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
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
        only_if_cloudConnected(() => {
          state.cloud.items.add[found.id] = CryptNote.encrypt(found);
        });
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

        only_if_cloudConnected(() => {
          state.cloud.items.delete[note.id] = CryptNote.encrypt(note);
        });
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
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
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

        only_if_cloudConnected(() => {
          state.cloud.items.add[note.id] = CryptNote.encrypt(note);
        });
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

        only_if_cloudConnected(() => {
          state.cloud.items.add[note.id] = CryptNote.encrypt(note);
        });
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

        only_if_cloudConnected(() => {
          state.cloud.items.add[note.id] = CryptNote.encrypt(note);
        });
      });
      state.temporaryItems = [];

      sortNotes(state.items, state.filters);
    },

    setNotes: (state, action: PayloadAction<{ notes: Note[]; fromSync?: boolean }>) => {
      const { notes, fromSync } = action.payload;

      state.items = [...notes];

      sortNotes(state.items, state.filters);

      if (!fromSync) {
        only_if_cloudConnected(() => {
          state.items.forEach((note) => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
        });
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

        only_if_cloudConnected(() => {
          state.cloud.items.delete[note.id] = CryptNote.encrypt(note);
        });
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

        only_if_cloudConnected(() => {
          state.cloud.items.delete[note.id] = CryptNote.encrypt(note);
        });
        return false;
      });
    },

    toggleImportantNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.important = !note.important;
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
        }
      });
    },

    toggleReadOnlyNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.readOnly = !note.readOnly;
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
        }
      });
    },

    toggleHiddenNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.hidden = !note.hidden;
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
        }
      });
    },

    toggleProtectedNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.locked = !note.locked;
          only_if_cloudConnected(() => {
            state.cloud.items.add[note.id] = CryptNote.encrypt(note);
          });
        }
      });
    },

    addLocalNotes: (state, action: PayloadAction<Record<string, Note>>) => {
      Object.values(action.payload)
        .sort(createdAt_asc_sort)
        .forEach((cloudNote) => {
          const note = CryptNote.decrypt(cloudNote);
          const idx = state.items.findIndex((n) => n.id === note.id);
          if (idx === -1) {
            state.items.unshift(note);
          } else {
            state.items[idx] = note;
          }
        });

      sortNotes(state.items, state.filters);
    },

    deleteLocalNotes: (state, action: PayloadAction<Record<string, Note>>) => {
      Object.values(action.payload).forEach((cloudNote) => {
        state.items = state.items.filter((localNote) => {
          if (localNote.id !== cloudNote.id) return true;

          localNote.deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;
          state.temporaryItems.unshift(localNote);
          return false;
        });
      });
    },

    resetCloudNotes: (state) => {
      state.cloud.items.add = {};
      state.cloud.items.delete = {};
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
