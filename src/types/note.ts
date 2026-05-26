import type { Category } from "./category";

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface KanbanItem {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  items: KanbanItem[];
}

export interface CodeTab {
  id: string;
  title: string;
  code: string;
  language: string;
}

export type NoteType = "text" | "todo" | "kanban" | "code";

export interface NoteBase {
  id: string;
  type: NoteType;
  title: string;
  category: Category;
  date: string;
  createdAt: number;
  updatedAt: number;
  important: boolean;
  locked: boolean;
  readOnly: boolean;
  hidden: boolean;
  /**
   * When true the note lives only on this device: it is never uploaded to the
   * cloud and incoming cloud copies for the same id are ignored. Re-syncing an
   * offline note creates a brand-new note (new id + " (2)" title) to avoid any
   * overlap with stale cloud/other-device versions.
   */
  local?: boolean;
  deleteDate: number | null;
}

export interface TextNote extends NoteBase {
  type: "text";
  text: string;
}

export type TodoMode = "free" | "steps";

export interface TodoNote extends NoteBase {
  type: "todo";
  list: TodoItem[];
  mode?: TodoMode;
}

export interface KanbanNote extends NoteBase {
  type: "kanban";
  columns: KanbanColumn[];
}

export interface CodeNote extends NoteBase {
  type: "code";
  tabs: CodeTab[];
  activeTabId: string;
}

export type Note = TextNote | TodoNote | KanbanNote | CodeNote;
