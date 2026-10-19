import { createSlice, original } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import type { Category, Note, NoteFilters, NotesState, RootState } from "@/types";

import { retrieveDirtyNoteId } from "@/libs/registry";

import type { SyncPlan } from "@/libs/cloud/merge";
import type { NotesPushed } from "@/libs/cloud/syncEngine";

import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import { only_if_cloudConnected } from "@/libs/cloud";
import { deletionStub, forUpload, nextRev, noteRev, pruneTombstones, touchNote } from "@/libs/cloud/revision";
import { isVaultUnlocked } from "@/libs/vaultSession";
import { CryptNote } from "@/utils/crypt";
import { wipeNotes } from "./thunks/notes";

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
    // The upload supersedes a pending deletion (e.g. trashed, then restored while offline): uploads
    // run before deletions, so keeping both would delete the restored note from the cloud. Cancelling
    // needs no DEK, so it also happens while the vault is locked (the resync on unlock uploads the note).
    delete state.cloud.items.delete[note.id];
    if (!isVaultUnlocked()) return;
    // The sync engine encrypts the stored note again when it pushes (its latest content, under the current key): this
    // copy marks the note as waiting, and keeps the outbox readable by an older app version after a rollback.
    state.cloud.items.add[note.id] = CryptNote.encrypt(forUpload(note));
  });
};

/**
 * Queue a note for cloud deletion — unless it is an offline (device-only) note. A stub goes out (id and revision): it
 * needs no DEK, so it also works while the vault is locked, and leaks no content into the fan-out doc.
 */
const queueCloudDelete = (state: NotesState, note: Note): void => {
  if (note.local) return;
  only_if_cloudConnected(() => {
    state.cloud.items.delete[note.id] = deletionStub(note);
    delete state.cloud.items.add[note.id];
  });
};

/** Moves a note to the trash (a draft): stamps the deletion, which is a synced change. */
const trashNote = (note: Note, deleteDate: number): void => {
  note.deleteDate = deleteDate;
  touchNote(note);
  note.deletedAt = note.rev;
};

/** Takes a note out of the trash (a draft). Restoring is a synced change too: it beats the deletion. */
const untrashNote = (note: Note): void => {
  delete (note as Partial<Note>).deleteDate;
  delete note.deletedAt;
  touchNote(note);
};

/** Permanent deletion: remembers the id, so an older copy still queued on another device can't bring it back. */
const markPurged = (state: NotesState, notes: Note[]): void => {
  if (!state.purged) state.purged = {};
  const purged = state.purged;
  notes.forEach((note) => {
    if (!note.local) purged[note.id] = noteRev(note);
  });
  pruneTombstones(purged);
};

/** Dequeues what was pushed, unless a newer entry replaced it meanwhile (that one still has to go out). */
const dequeuePushed = (queue: Record<string, Note>, pushed: NotesPushed["add"]): void => {
  const base = original(queue);
  pushed.forEach(({ id, entry }) => {
    if (base?.[id] === entry) delete queue[id];
  });
};

/** The cloud now has `rev` of this note (a draft). */
const markSynced = (note: Note | undefined, rev: number): void => {
  if (note && !note.local) note.syncedRev = Math.max(note.syncedRev ?? 0, rev);
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
        // Not live: new, or trashed meanwhile (e.g. on another device) while an editor still had it open, which
        // brings it back.
        const trashed = state.temporaryItems.find((n) => n.id === action.payload.id);
        if (trashed) state.temporaryItems = state.temporaryItems.filter((n) => n !== trashed);
        const { syncedRev: _syncedRev, deletedAt: _deletedAt, ...created } = action.payload;
        const note = {
          ...created,
          rev: nextRev(trashed ?? action.payload),
          ...(trashed ? { syncedRev: trashed.syncedRev, local: trashed.local } : {}),
        } as Note;
        if ((state.filters?.order ?? "desc") === "desc") {
          state.items.unshift(note);
        } else {
          state.items.push(note);
        }
        queueCloudAdd(state, note);
      } else {
        // The payload is an editor's copy: the sync bookkeeping, and whether the note is device-only, are the store's
        // (an incoming change or a detach may have updated them since the editor loaded the note).
        const stored = state.items[idx];
        const note = {
          ...action.payload,
          rev: nextRev(stored),
          syncedRev: stored.syncedRev,
          local: stored.local,
        } as Note;
        state.items[idx] = note;

        const dirtyId = retrieveDirtyNoteId();

        if (dirtyId === action.payload.id) {
          sortNotes(state.items, state.filters);
        }
        queueCloudAdd(state, note);
      }
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
          touchNote(note);
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
        touchNote(found);
        queueCloudAdd(state, found);
      }
    },

    deleteNote: (state, action: PayloadAction<string>) => {
      markPurged(
        state,
        state.temporaryItems.filter((n) => n.id === action.payload)
      );
      state.temporaryItems = state.temporaryItems.filter((n) => n.id !== action.payload);
    },

    deleteSelectedNotes: (state, action: PayloadAction<{ selectedNotes: string[] }>) => {
      const isSelected = (n: Note) => action.payload.selectedNotes.includes(`${n.id}|${n.locked}`);
      markPurged(state, state.temporaryItems.filter(isSelected));
      state.temporaryItems = state.temporaryItems.filter((n) => !isSelected(n));
    },

    deleteAllNotes: (state) => {
      markPurged(state, state.temporaryItems);
      state.temporaryItems = [];
    },

    deleteNotesCategory: (state, action: PayloadAction<string>) => {
      const icon = action.payload;
      state.items = state.items.filter((note) => {
        if (note.category.icon !== icon) return true;

        trashNote(note, Date.now() + state.temporaryTrashTimespan * 86400000);
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
          touchNote(note);
          queueCloudAdd(state, note);
        }
      });
    },

    restoreNote: (state, action: PayloadAction<{ id: string; categories: Category[] }>) => {
      const { id, categories } = action.payload;
      state.temporaryItems = state.temporaryItems.filter((note) => {
        if (note.id !== id) return true;

        untrashNote(note);
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

        untrashNote(note);
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
        untrashNote(note);

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

    /** Replaces the notes (import). They keep their revisions: newer cloud versions still win, the rest is uploaded. */
    setNotes: (state, action: PayloadAction<{ notes: Note[] }>) => {
      // Another device's (or an older) sync bookkeeping means nothing here.
      state.items = action.payload.notes.map(({ syncedRev: _syncedRev, ...note }) => note as Note);

      sortNotes(state.items, state.filters);

      state.items.forEach((note) => queueCloudAdd(state, note));
    },

    setTrashedNotes: (state, action: PayloadAction<Note[]>) => {
      state.temporaryItems = action.payload.map(({ syncedRev: _syncedRev, ...note }) => note as Note);
    },

    setTemporaryTrashTimespan: (state, action: PayloadAction<number>) => {
      state.temporaryTrashTimespan = action.payload;
    },

    temporaryDeleteNote: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.items = state.items.filter((note) => {
        if (note.id !== id) return true;

        trashNote(note, Date.now() + state.temporaryTrashTimespan * 86400000);

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

        trashNote(note, Date.now() + state.temporaryTrashTimespan * 86400000);

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
          touchNote(note);
          queueCloudAdd(state, note);
        }
      });
    },

    toggleReadOnlyNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.readOnly = !note.readOnly;
          touchNote(note);
          queueCloudAdd(state, note);
        }
      });
    },

    toggleHiddenNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.hidden = !note.hidden;
          touchNote(note);
          queueCloudAdd(state, note);
        }
      });
    },

    toggleProtectedNotes: (state, action: PayloadAction<string[]>) => {
      state.items.forEach((note) => {
        if (action.payload.includes(`${note.id}|${note.locked}`)) {
          note.locked = !note.locked;
          touchNote(note);
          queueCloudAdd(state, note);
        }
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
      const { syncedRev: _syncedRev, ...note } = state.items[idx];
      const reattached: Note = {
        ...note,
        id: newId,
        title: `${state.items[idx].title ?? ""} (2)`.trim(),
        local: false,
        createdAt: now,
        updatedAt: now,
        rev: now,
      } as Note;

      state.items[idx] = reattached;
      sortNotes(state.items, state.filters);

      queueCloudAdd(state, reattached);
    },

    /** Merges incoming cloud changes (a plan made by the sync engine, see `libs/cloud/merge`). */
    applyNotesPlan: (state, action: PayloadAction<SyncPlan>) => {
      const plan = action.payload;
      const { cloud } = state;

      if (plan.put.length > 0) {
        const put = new Map(plan.put.map((note) => [note.id, note]));
        state.temporaryItems = state.temporaryItems.filter((note) => !put.has(note.id));
        state.items = state.items.map((note) => {
          const next = put.get(note.id);
          if (!next) return note;
          put.delete(note.id);
          return next;
        });
        state.items.unshift(...put.values());
      }

      if (plan.trash.length > 0) {
        const deleteDate = Date.now() + state.temporaryTrashTimespan * 86400000;
        const trash = new Map(plan.trash.map((note) => [note.id, { ...note, deleteDate }]));
        state.items = state.items.filter((note) => !trash.has(note.id));
        state.temporaryItems = state.temporaryItems.filter((note) => !trash.has(note.id));
        state.temporaryItems.unshift(...trash.values());
      }

      plan.detach.forEach((id) => {
        const note = state.items.find((n) => n.id === id);
        if (note) note.local = true;
        delete cloud.items.add[id];
        delete cloud.items.delete[id];
      });

      const synced = Object.entries(plan.synced);
      if (synced.length > 0) {
        const byId = new Map([...state.items, ...state.temporaryItems].map((note) => [note.id, note]));
        synced.forEach(([id, rev]) => markSynced(byId.get(id), rev));
      }

      plan.dropUploads.forEach((id) => delete cloud.items.add[id]);
      plan.dropDeletes.forEach((id) => delete cloud.items.delete[id]);

      plan.upload.forEach((id) => {
        const note = state.items.find((n) => n.id === id);
        if (note) queueCloudAdd(state, note);
      });
      plan.sendDeletes.forEach((id) => {
        const note = state.temporaryItems.find((n) => n.id === id);
        if (note) queueCloudDelete(state, note);
      });
      plan.sendStubs.forEach((stub) => {
        only_if_cloudConnected(() => {
          cloud.items.delete[stub.id] = stub;
          delete cloud.items.add[stub.id];
        });
      });

      sortNotes(state.items, state.filters);
    },

    /** What a push committed: dequeued, and the cloud now has those revisions. */
    notesPushed: (state, action: PayloadAction<NotesPushed>) => {
      const { add, delete: deleted, detach } = action.payload;
      const { items } = state.cloud;
      dequeuePushed(items.add, add);
      dequeuePushed(items.delete, deleted);
      if (items.detach) dequeuePushed(items.detach, detach);

      if (add.length > 0) {
        const live = new Map(state.items.map((note) => [note.id, note]));
        add.forEach(({ id, rev }) => markSynced(live.get(id), rev));
      }
      if (deleted.length > 0) {
        const trashed = new Map(state.temporaryItems.map((note) => [note.id, note]));
        deleted.forEach(({ id, rev }) => markSynced(trashed.get(id), rev));
      }
    },

    /** Uploads queued for notes no longer stored as live ones. */
    dropNoteUploads: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach((id) => delete state.cloud.items.add[id]);
    },
  },

  extraReducers: (builder) => {
    builder.addCase(wipeNotes, (state) => {
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
  detachNote,
  reattachNote,
  applyNotesPlan,
  notesPushed,
  dropNoteUploads,
} = notesSlice.actions;

// Selectors
export const getNote =
  (id: string) =>
  (state: RootState): Note | undefined =>
    state.notes.items.find((note) => note.id === id);
export const getAllNotes = (state: RootState): Note[] => state.notes.items;
export const getAllTrashedNotes = (state: RootState): Note[] => state.notes.temporaryItems;
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
