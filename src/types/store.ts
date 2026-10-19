import type { Category } from "./category";
import type { Note } from "./note";
import type { SettingsState } from "./settings";

export interface NoteFilters {
  sortBy: "createdAt" | "updatedAt";
  order: "asc" | "desc";
}

export interface NotesState {
  items: Note[];
  temporaryItems: Note[];
  temporaryTrashTimespan: number;
  cloud: {
    items: {
      add: Record<string, Note>;
      delete: Record<string, Note>;
      /** Notes detached from the cloud: removed remotely + signalled to other devices. */
      detach: Record<string, Note>;
    };
  };
  filters: NoteFilters;
  /**
   * Ids of permanently deleted notes -> the revision they were deleted at, so an older copy still queued somewhere can't
   * bring them back (ADR-016). Pruned after a while.
   */
  purged?: Record<string, number>;
}

export interface CategoriesState {
  items: Category[];
  cloud: {
    items: {
      add: Record<string, Category>;
      delete: Record<string, Category>;
    };
  };
}

export interface RootState {
  notes: NotesState;
  categories: CategoriesState;
  settings: SettingsState;
}
