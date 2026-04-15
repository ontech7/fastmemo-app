import { CATEGORY_MAP } from "@/constants/icons";
import { store } from "@/slicers/store";
import { Category, Note } from "@/types";
import { formatDateTime } from "@/utils/date";
import uuid from "react-uuid";
import { ExecutionResult } from "./executor";

export function getCurrentCategory(): Category {
  const state = store.getState();
  const categories = state.categories.items;
  const current = categories.find((c: Category) => c.selected);
  return current || categories[0];
}

export function findNotesByTitle(search: string): Note[] {
  const state = store.getState();
  const notes = state.notes.items;
  const lowerSearch = search.toLowerCase();
  return notes.filter((note: Note) => note.title?.toLowerCase().includes(lowerSearch));
}

export function findTrashedNotesByTitle(search: string): Note[] {
  const state = store.getState();
  const notes = state.notes.temporaryItems;
  const lowerSearch = search.toLowerCase();
  return notes.filter((note: Note) => note.title?.toLowerCase().includes(lowerSearch));
}

export function findCategoryByName(name: string): Category | undefined {
  const state = store.getState();
  const categories = state.categories.items;
  const lowerName = name.toLowerCase();
  return categories.find((c: Category) => c.name.toLowerCase().includes(lowerName));
}

export function getFirstUnusedIcon(): string | null {
  const state = store.getState();
  const categories = state.categories.items;
  const usedIcons = new Set(categories.map((c: Category) => c.icon));
  const available = Object.keys(CATEGORY_MAP).find((key) => key !== "none" && !usedIcons.has(key));
  return available || null;
}

export function createBaseNote(
  type: Note["type"],
  title: string
): Omit<Note, "text" | "list" | "columns"> & { id: string; type: typeof type } {
  const now = Date.now();
  return {
    id: uuid(),
    type,
    title,
    category: getCurrentCategory(),
    date: formatDateTime(),
    createdAt: now,
    updatedAt: now,
    important: false,
    locked: false,
    readOnly: false,
    hidden: false,
    deleteDate: null,
  };
}

/** Check if any of the given notes are locked. If so, return requires_auth. */
export function checkAuth(notes: Note[], bypassAuth?: boolean): ExecutionResult | null {
  if (bypassAuth) return null;
  const hasLocked = notes.some((n) => n.locked);
  if (hasLocked) return { success: false, message: "requires_auth" };
  return null;
}

export function normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...params };

  // categoryName aliases
  if (!normalized.categoryName && !normalized.targetCategoryName && !normalized.category && !normalized.category_name) {
    // If no category param at all, default to "all" for switch-like actions
    if (normalized.view) {
      normalized.categoryName = normalized.view;
      delete normalized.view;
    }
  }
  if (!normalized.categoryName && normalized.targetCategoryName) {
    normalized.categoryName = normalized.targetCategoryName;
    delete normalized.targetCategoryName;
  }
  if (!normalized.categoryName && normalized.category) {
    normalized.categoryName = normalized.category;
    delete normalized.category;
  }
  if (!normalized.categoryName && normalized.category_name) {
    normalized.categoryName = normalized.category_name;
    delete normalized.category_name;
  }

  // newTitle aliases
  if (!normalized.newTitle && normalized.new_title) {
    normalized.newTitle = normalized.new_title;
    delete normalized.new_title;
  }
  if (!normalized.newTitle && normalized.title && normalized.search && !normalized.searches) {
    // If both search and title exist (but not searches for merge), title is probably the newTitle
    normalized.newTitle = normalized.title;
    delete normalized.title;
  }

  // targetType aliases
  if (!normalized.targetType && normalized.target_type) {
    normalized.targetType = normalized.target_type;
    delete normalized.target_type;
  }
  if (!normalized.targetType && normalized.to) {
    normalized.targetType = normalized.to;
    delete normalized.to;
  }

  return normalized;
}

/**
 * Try to parse JSON, with fallback recovery for truncated output.
 * When n_predict is reached mid-string, the JSON may be cut off.
 * We try progressively aggressive repairs: closing brackets, trimming trailing content.
 */
export function tryParseJSON(text: string): Record<string, unknown> | null {
  // 1. Try as-is
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // 2. Try closing open brackets/braces
  let repaired = text;

  // Trim any trailing incomplete string value (e.g. cut mid-sentence)
  repaired = repaired.replace(/,"[^"]*$/, "");
  repaired = repaired.replace(/,"?$/, "");

  // Count open/close braces and brackets
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;

  // Close any unclosed quotes if we're mid-string
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // Close brackets then braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

  try {
    return JSON.parse(repaired);
  } catch {
    // continue
  }

  // 3. Last resort: extract the first valid-looking JSON object
  const match = text.match(/\{[\s\S]*?"action"\s*:\s*"[^"]+"/);
  if (match) {
    // Find the action and type, construct minimal JSON
    const actionMatch = text.match(/"action"\s*:\s*"([^"]+)"/);
    const typeMatch = text.match(/"type"\s*:\s*"([^"]+)"/);
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);

    if (actionMatch) {
      const obj: Record<string, unknown> = { action: actionMatch[1] };
      if (typeMatch) obj.type = typeMatch[1];
      if (titleMatch) obj.title = titleMatch[1];

      // Try to extract items array
      const itemsMatch = text.match(/"items"\s*:\s*\[([\s\S]*?)]/);
      if (itemsMatch) {
        try {
          obj.items = JSON.parse(`[${itemsMatch[1]}]`);
        } catch {
          // skip items
        }
      }

      // Try to extract content
      const contentMatch = text.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (contentMatch) obj.content = contentMatch[1];

      return obj;
    }
  }

  return null;
}
