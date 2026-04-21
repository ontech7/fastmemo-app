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
  deleteDate: number | null;
}

export interface TextNote extends NoteBase {
  type: "text";
  text: string;
}

export interface TodoNote extends NoteBase {
  type: "todo";
  list: TodoItem[];
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
