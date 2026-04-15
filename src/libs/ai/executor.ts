import { KANBAN_COLUMN_COLORS } from "@/constants/styles";
import { createCategory, swapCategory } from "@/slicers/categoriesSlice";
import {
  addNote,
  changeNoteCategory,
  restoreNote,
  temporaryDeleteNote,
  toggleHiddenNotes,
  toggleImportantNotes,
  toggleProtectedNotes,
  toggleReadOnlyNotes,
} from "@/slicers/notesSlice";
import { setIsFingerprintEnabled, setShowHidden, setVoiceRecognition } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import type { KanbanNote, Note, TextNote, TodoNote } from "@/types";
import { formatDateTime } from "@/utils/date";
import { formatToPlainText } from "@/utils/string";
import uuid from "react-uuid";
import {
  checkAuth,
  createBaseNote,
  findCategoryByName,
  findNotesByTitle,
  findTrashedNotesByTitle,
  getFirstUnusedIcon,
  normalizeParams,
} from "./helpers";
import type { AIToolCall } from "./types";

export interface ExecutionResult {
  success: boolean;
  message: string;
  noteId?: string;
}

export interface ExecuteOptions {
  bypassAuth?: boolean;
}

function executeCreateNote(params: Record<string, unknown>): ExecutionResult {
  const type = (params.type as string) || "text";
  const title = (params.title as string) || "";
  const categoryName = params.categoryName as string | undefined;

  const baseNote = createBaseNote(type as "text" | "todo" | "kanban", title);

  // Override category if specified
  if (categoryName) {
    const targetCategory = findCategoryByName(categoryName);
    if (targetCategory) {
      baseNote.category = targetCategory;
    }
  }

  let note: Note;

  switch (type) {
    case "todo": {
      let items = (params.items as string[]) || [];

      // Fallback: if model returned content/text instead of items, try to extract
      if (items.length === 0 && params.content) {
        const raw = String(params.content);
        // Try to extract <li> items from HTML
        const liMatches = raw.match(/<li>(.*?)<\/li>/gi);
        if (liMatches) {
          items = liMatches.map((m) => m.replace(/<\/?li>/gi, "").trim()).filter(Boolean);
        } else {
          // Split by commas or newlines
          items = raw
            .split(/[,\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      const list = items.map((text) => ({ id: uuid(), text, checked: false }));
      if (list.length === 0) list.push({ id: uuid(), text: "", checked: false });
      note = { ...baseNote, type: "todo", list } as TodoNote;
      break;
    }
    case "kanban": {
      const columnsData = (params.columns as Array<{ name: string; cards?: string[] }>) || [];
      const columns = columnsData.map((col, idx) => ({
        id: uuid(),
        name: col.name,
        color: KANBAN_COLUMN_COLORS[idx % KANBAN_COLUMN_COLORS.length],
        items: (col.cards || []).map((cardText) => ({ id: uuid(), text: cardText })),
      }));
      if (columns.length === 0) columns.push({ id: uuid(), name: "", color: KANBAN_COLUMN_COLORS[0], items: [] });
      note = { ...baseNote, type: "kanban", columns } as KanbanNote;
      break;
    }
    default: {
      const content = (params.content as string) || "";
      const hasHtml = /<[a-z][\s\S]*>/i.test(content);
      note = { ...baseNote, type: "text", text: content ? (hasHtml ? content : `<div>${content}</div>`) : "" } as TextNote;
      break;
    }
  }

  store.dispatch(addNote(note));
  return { success: true, message: title, noteId: note.id };
}

function executeToggleProperty(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  const property = params.property as string;
  if (!search || !property) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const authCheck = checkAuth(matchingNotes, opts?.bypassAuth);
  if (authCheck) return authCheck;

  const noteIds = matchingNotes.map((n) => `${n.id}|${n.locked}`);

  switch (property) {
    case "important":
      store.dispatch(toggleImportantNotes(noteIds));
      break;
    case "readOnly":
      store.dispatch(toggleReadOnlyNotes(noteIds));
      break;
    case "hidden":
      store.dispatch(toggleHiddenNotes(noteIds));
      break;
    case "locked":
      store.dispatch(toggleProtectedNotes(noteIds));
      break;
    default:
      return { success: false, message: "invalid_property" };
  }

  return { success: true, message: `${matchingNotes.length}` };
}

function executeDeleteNote(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  if (!search) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const authCheck = checkAuth(matchingNotes, opts?.bypassAuth);
  if (authCheck) return authCheck;

  matchingNotes.forEach((note) => store.dispatch(temporaryDeleteNote(note.id)));
  return { success: true, message: `${matchingNotes.length}` };
}

function executeChangeCategory(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  const categoryName = params.categoryName as string;
  if (!search || !categoryName) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const authCheck = checkAuth(matchingNotes, opts?.bypassAuth);
  if (authCheck) return authCheck;

  const category = findCategoryByName(categoryName);
  if (!category) return { success: false, message: "category_not_found" };

  matchingNotes.forEach((note) => {
    store.dispatch(changeNoteCategory({ note, iconTo: category.icon, nameTo: category.name }));
  });
  return { success: true, message: `${matchingNotes.length}` };
}

function executeRenameNote(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  const newTitle = params.newTitle as string;
  if (!search || !newTitle) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const note = matchingNotes[0];
  const authCheck = checkAuth([note], opts?.bypassAuth);
  if (authCheck) return authCheck;

  const now = Date.now();
  store.dispatch(addNote({ ...note, title: newTitle, updatedAt: now, date: formatDateTime() }));
  return { success: true, message: newTitle };
}

function executeAddTodoItems(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  const items = params.items as string[];
  if (!search || !items || items.length === 0) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const note = matchingNotes[0];
  if ((note.type || "text") !== "todo") return { success: false, message: "not_todo_note" };

  const authCheck = checkAuth([note], opts?.bypassAuth);
  if (authCheck) return authCheck;

  const todoNote = note as TodoNote;
  const newItems = items.map((text) => ({ id: uuid(), text, checked: false }));
  const now = Date.now();
  store.dispatch(addNote({ ...todoNote, list: [...todoNote.list, ...newItems], updatedAt: now, date: formatDateTime() }));
  return { success: true, message: `${items.length}` };
}

function executeCreateCategory(params: Record<string, unknown>): ExecutionResult {
  const name = params.name as string;
  if (!name) return { success: false, message: "missing_params" };

  const existing = findCategoryByName(name);
  if (existing) return { success: false, message: "category_exists" };

  const icon = getFirstUnusedIcon();
  if (!icon) return { success: false, message: "no_icons_available" };

  store.dispatch(createCategory({ name, icon }));
  return { success: true, message: name };
}

function executeRestoreNote(params: Record<string, unknown>): ExecutionResult {
  const search = params.search as string;
  if (!search) return { success: false, message: "missing_params" };

  const matchingNotes = findTrashedNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const state = store.getState();
  const categories = state.categories.items;
  matchingNotes.forEach((note) => store.dispatch(restoreNote({ id: note.id, categories })));
  return { success: true, message: `${matchingNotes.length}` };
}

function executeSwitchCategory(params: Record<string, unknown>): ExecutionResult {
  const categoryName = (params.categoryName as string) || "all";

  const lowerName = categoryName.toLowerCase();
  if (
    [
      "all",
      "tutte",
      "tutto",
      "todas",
      "alle",
      "toutes",
      "all notes",
      "tutte le note",
      "toutes les notes",
      "todas las notas",
      "alle notizen",
    ].includes(lowerName)
  ) {
    store.dispatch(swapCategory({ icon: "none" }));
    return { success: true, message: categoryName };
  }

  const category = findCategoryByName(categoryName);
  if (!category) return { success: false, message: "category_not_found" };

  store.dispatch(swapCategory({ icon: category.icon }));
  return { success: true, message: category.name };
}

function executeConvertNote(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const search = params.search as string;
  const targetType = params.targetType as string;
  if (!search || !targetType) return { success: false, message: "missing_params" };

  const matchingNotes = findNotesByTitle(search);
  if (matchingNotes.length === 0) return { success: false, message: "no_notes_found" };

  const note = matchingNotes[0];
  const authCheck = checkAuth([note], opts?.bypassAuth);
  if (authCheck) return authCheck;

  const sourceType = note.type || "text";
  if (sourceType === targetType) return { success: false, message: "same_type" };

  const now = Date.now();
  const base = { ...note, updatedAt: now, date: formatDateTime() };

  let converted: Note;

  if (targetType === "todo") {
    // text/kanban -> todo: extract lines as items
    let items: string[] = [];
    if (sourceType === "text") {
      const plainText = formatToPlainText((note as TextNote).text || "");
      items = plainText
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
    } else if (sourceType === "kanban") {
      (note as KanbanNote).columns.forEach((col) => {
        col.items.forEach((item) => {
          if (item.text) items.push(item.text);
        });
      });
    }
    if (items.length === 0) items.push("");
    const list = items.map((text) => ({ id: uuid(), text, checked: false }));
    converted = { ...base, type: "todo", list } as unknown as TodoNote;
    // Remove old type-specific fields
    delete (converted as any).text;
    delete (converted as any).columns;
  } else if (targetType === "text") {
    // todo/kanban -> text: join content
    let content = "";
    if (sourceType === "todo") {
      const items = (note as TodoNote).list.map((item) => item.text).filter(Boolean);
      content = `<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;
    } else if (sourceType === "kanban") {
      content = (note as KanbanNote).columns
        .map((col) => `<h1>${col.name}</h1><ul>${col.items.map((i) => `<li>${i.text}</li>`).join("")}</ul>`)
        .join("");
    }
    converted = { ...base, type: "text", text: content } as unknown as TextNote;
    delete (converted as any).list;
    delete (converted as any).columns;
  } else {
    return { success: false, message: "invalid_target_type" };
  }

  store.dispatch(addNote(converted));
  return { success: true, message: note.title };
}

function executeMergeNotes(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const searches = params.searches as string[];
  const mergeTitle = params.title as string;
  if (!searches || searches.length < 2) return { success: false, message: "missing_params" };

  // Find all notes
  const allNotes: Note[] = [];
  for (const search of searches) {
    const found = findNotesByTitle(search);
    if (found.length === 0) return { success: false, message: "no_notes_found" };
    allNotes.push(found[0]);
  }

  // Auth check on all involved notes
  const authCheck = checkAuth(allNotes, opts?.bypassAuth);
  if (authCheck) return authCheck;

  // Merge content into a single text note
  const title = mergeTitle || allNotes.map((n) => n.title).join(" + ");
  const contentParts: string[] = [];

  for (const note of allNotes) {
    const type = note.type || "text";
    contentParts.push(`<h1>${note.title}</h1>`);
    if (type === "text") {
      contentParts.push((note as TextNote).text || "");
    } else if (type === "todo") {
      const items = (note as TodoNote).list.filter((i) => i.text);
      contentParts.push(`<ul>${items.map((i) => `<li>${i.text}</li>`).join("")}</ul>`);
    } else if (type === "kanban") {
      for (const col of (note as KanbanNote).columns) {
        contentParts.push(`<b>${col.name}</b>`);
        if (col.items.length > 0) {
          contentParts.push(`<ul>${col.items.map((i) => `<li>${i.text}</li>`).join("")}</ul>`);
        }
      }
    }
  }

  const baseNote = createBaseNote("text", title);
  const merged: TextNote = { ...baseNote, type: "text", text: contentParts.join("") };
  store.dispatch(addNote(merged));

  // Delete originals
  allNotes.forEach((note) => store.dispatch(temporaryDeleteNote(note.id)));

  return { success: true, message: title, noteId: merged.id };
}

// Settings that require authentication (same as the app's UI guards)
const AUTH_REQUIRED_SETTINGS = new Set(["show_hidden", "fingerprint"]);

function executeChangeSetting(params: Record<string, unknown>, opts?: ExecuteOptions): ExecutionResult {
  const setting = params.setting as string;
  const value = params.value as boolean;
  if (!setting || value === undefined) return { success: false, message: "missing_params" };

  // Auth check for sensitive settings
  if (AUTH_REQUIRED_SETTINGS.has(setting) && !opts?.bypassAuth) {
    return { success: false, message: "requires_auth" };
  }

  const state = store.getState();

  switch (setting) {
    case "voice_recognition": {
      const current = state.settings.voiceRecognition;
      store.dispatch(setVoiceRecognition({ ...current, enabled: value }));
      return { success: true, message: setting };
    }
    case "show_hidden": {
      store.dispatch(setShowHidden(value));
      return { success: true, message: setting };
    }
    case "fingerprint": {
      store.dispatch(setIsFingerprintEnabled(value));
      return { success: true, message: setting };
    }
    default:
      return { success: false, message: "invalid_setting" };
  }
}

const ACTION_ALIASES: Record<string, string> = {
  move_note: "change_note_category",
  move_to_category: "change_note_category",
  set_property: "toggle_note_property",
  set_important: "toggle_note_property",
  remove_note: "delete_note",
  trash_note: "delete_note",
  new_note: "create_note",
  new_category: "create_category",
  go_to_category: "switch_category",
  navigate_category: "switch_category",
  show_all: "switch_category",
  show_all_notes: "switch_category",
  show_notes: "switch_category",
  view_all: "switch_category",
  convert: "convert_note",
  merge: "merge_notes",
  rename: "rename_note",
  restore: "restore_note",
  add_items: "add_todo_items",
  help: "show_help",
  setting: "change_setting",
};

// --- Main dispatch ---

export function executeToolCall(toolCall: AIToolCall, opts?: ExecuteOptions): ExecutionResult {
  const action = ACTION_ALIASES[toolCall.action] || toolCall.action;
  const params = normalizeParams(toolCall.params);

  switch (action) {
    case "create_note":
      return executeCreateNote(params);
    case "toggle_note_property":
      return executeToggleProperty(params, opts);
    case "delete_note":
      return executeDeleteNote(params, opts);
    case "change_note_category":
      return executeChangeCategory(params, opts);
    case "rename_note":
      return executeRenameNote(params, opts);
    case "add_todo_items":
      return executeAddTodoItems(params, opts);
    case "create_category":
      return executeCreateCategory(params);
    case "restore_note":
      return executeRestoreNote(params);
    case "switch_category":
      return executeSwitchCategory(params);
    case "convert_note":
      return executeConvertNote(params, opts);
    case "merge_notes":
      return executeMergeNotes(params, opts);
    case "change_setting":
      return executeChangeSetting(params, opts);
    case "show_help":
      return { success: true, message: "show_help" };
    default:
      return { success: false, message: "unknown_action" };
  }
}
