import type { Category } from "./category";

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface KanbanItem {
  id: string;
  text: string;
  /** When the card was added (cards made before 4.1.0 may lack it). */
  createdAt?: number;
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
  /**
   * Cloud sync revision (ADR-016): stamped on every change that syncs, and never lower than the previous one, so it orders
   * the versions of a note across devices. Older app versions only bump `updatedAt`: use `noteRev()`, never this alone.
   */
  rev?: number;
  /** Local bookkeeping, never uploaded: the revision last known to be in the cloud. Higher `noteRev()`: unpushed changes. */
  syncedRev?: number;
  /** When the note was moved to the trash (the revision of that move). */
  deletedAt?: number;
  /**
   * A reminder (spec D.5, ADR-044): when the phone should ring for this note, epoch milliseconds. Synced like the title
   * (never encrypted); a time that has passed is ignored, never cleared. Absent when there is none.
   */
  remindAt?: number;
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
  /** The done items out of sight in the editor (spec B.7): a field of the note, so it syncs. */
  hideDone?: boolean;
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
