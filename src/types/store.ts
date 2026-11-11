import type { Category } from "./category";
import type { Note } from "./note";
import type { SettingsState } from "./settings";

export interface NoteFilters {
  sortBy: "createdAt" | "updatedAt";
  order: "asc" | "desc";
}

/** A note waiting to be uploaded. The engine uploads the stored note, encrypted at that moment: this only marks it. */
export interface UploadMarker {
  id: string;
  rev: number;
}

export interface NotesState {
  items: Note[];
  temporaryItems: Note[];
  temporaryTrashTimespan: number;
  cloud: {
    items: {
      /**
       * Notes waiting to be uploaded, by id: a marker, a new object at each commit (the engine dequeues an entry only if it
       * is still the one it pushed). A `Note` here is an entry written by 4.0.0 or earlier, an encrypted copy, used only as
       * "this id is waiting" (ADR-036).
       */
      add: Record<string, UploadMarker | Note>;
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
