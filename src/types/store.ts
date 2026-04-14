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
    };
  };
  filters: NoteFilters;
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
