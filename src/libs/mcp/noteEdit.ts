import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import { LANGUAGE_LABELS } from "@/constants/code-languages";
import type { McpDeps } from "@/libs/mcp/handlers";
import { byteSize, columnColor, findCategory, isRecord, normalizeTitle, tabLanguage } from "@/libs/mcp/noteInput";
import { withoutImageData } from "@/libs/mcp/noteView";
import type { Note } from "@/types";
import type { CodeTab, KanbanColumn, NoteType, TodoItem } from "@/types/note";

/*
 * What an agent asks to change in a note it has read, applied to a copy. Nothing here stores or sends anything, and the note
 * it's given is never mutated: a request that fails in any part changes nothing.
 */

export interface EditChanges {
  title?: string;
  category?: string | null;
  appendHtml?: string;
  replaceHtml?: string;
  addItems?: { text: string; checked?: boolean }[];
  updateItems?: { id: string; text?: string; checked?: boolean }[];
  removeItemIds?: string[];
  addColumns?: { name: string; color?: string }[];
  addCards?: { columnId: string; text: string }[];
  moveCards?: { cardId: string; toColumnId: string }[];
  removeCardIds?: string[];
  addTabs?: { title: string; language?: string; code: string }[];
  updateTabs?: { id: string; title?: string; language?: string; code?: string }[];
}

type Failure = { error: string };
type Edited = { content: Record<string, unknown> } | Failure;

/** The fields that only make sense for one type of note. */
const FIELDS_OF: Record<NoteType, readonly string[]> = {
  text: ["appendHtml", "replaceHtml"],
  todo: ["addItems", "updateItems", "removeItemIds"],
  kanban: ["addColumns", "addCards", "moveCards", "removeCardIds"],
  code: ["addTabs", "updateTabs"],
};

const NOTHING_TO_CHANGE = "Nothing to change: give at least one field that differs from the note.";

const present = (changes: Record<string, unknown>, field: string): boolean => changes[field] !== undefined;

/** The list in `field` (empty when absent), or what's wrong with it. */
function listOf(changes: Record<string, unknown>, field: string): { list: unknown[] } | Failure {
  const value = changes[field];
  if (value === undefined) return { list: [] };
  return Array.isArray(value) ? { list: value } : { error: `\`${field}\` must be a list.` };
}

const idsOf = (changes: Record<string, unknown>, field: string): { ids: string[] } | Failure => {
  const given = listOf(changes, field);
  if ("error" in given) return given;
  return given.list.every((id) => typeof id === "string")
    ? { ids: given.list as string[] }
    : { error: `\`${field}\` must be a list of ids.` };
};

const nonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function editText(note: Note, changes: Record<string, unknown>, deps: McpDeps): Edited {
  const text = "text" in note ? (note.text ?? "") : "";
  const { appendHtml, replaceHtml } = changes;
  if (present(changes, "appendHtml") && present(changes, "replaceHtml")) {
    return { error: "Give either `appendHtml` or `replaceHtml`, not both." };
  }
  if (present(changes, "replaceHtml")) {
    if (typeof replaceHtml !== "string") return { error: "`replaceHtml` must be HTML, as text." };
    if (withoutImageData(text) !== text) {
      return { error: "This note holds images, which a replacement would lose: use `appendHtml`, or edit it in Fast Memo." };
    }
    const html = deps.sanitize(replaceHtml);
    return html.trim() ? { content: { text: html } } : { error: "`replaceHtml` is empty: a note can't be left without text." };
  }
  if (present(changes, "appendHtml")) {
    if (typeof appendHtml !== "string") return { error: "`appendHtml` must be HTML, as text." };
    // Only the new part is cleaned, and only joined to the end: what the note already holds (its images) isn't touched.
    const html = deps.sanitize(appendHtml);
    return html.trim() ? { content: { text: text + html } } : { error: "`appendHtml` is empty." };
  }
  return { content: { text } };
}

function editTodo(note: Note, changes: Record<string, unknown>, deps: McpDeps): Edited {
  const updates = listOf(changes, "updateItems");
  if ("error" in updates) return updates;
  const removes = idsOf(changes, "removeItemIds");
  if ("error" in removes) return removes;
  const adds = listOf(changes, "addItems");
  if ("error" in adds) return adds;

  let list: TodoItem[] = (("list" in note ? note.list : undefined) ?? []).map((item) => ({ ...item }));

  for (const update of updates.list) {
    if (!isRecord(update) || typeof update.id !== "string") return { error: "Each item to update needs its `id`." };
    const item = list.find((candidate) => candidate.id === update.id);
    if (!item) return { error: `No todo item with the id "${update.id}": ids come from fastmemo_read_note.` };
    if (update.text === undefined && update.checked === undefined) {
      return { error: `The update of item "${update.id}" needs \`text\` or \`checked\`.` };
    }
    if (update.text !== undefined) {
      if (!nonBlank(update.text)) return { error: "An item's `text` can't be empty." };
      item.text = update.text;
    }
    if (update.checked !== undefined) {
      if (typeof update.checked !== "boolean") return { error: "An item's `checked` must be true or false." };
      item.checked = update.checked;
    }
  }

  for (const id of removes.ids) {
    if (!list.some((item) => item.id === id))
      return { error: `No todo item with the id "${id}": ids come from fastmemo_read_note.` };
  }
  list = list.filter((item) => !removes.ids.includes(item.id));

  for (const add of adds.list) {
    if (!isRecord(add) || typeof add.text !== "string") return { error: "Each item to add needs `text`." };
    if (add.checked !== undefined && typeof add.checked !== "boolean") {
      return { error: "An item's `checked` must be true or false." };
    }
    if (add.text.trim()) list.push({ id: deps.newId(), text: add.text, checked: add.checked === true });
  }
  return { content: { list } };
}

function editKanban(note: Note, changes: Record<string, unknown>, deps: McpDeps): Edited {
  const addColumns = listOf(changes, "addColumns");
  if ("error" in addColumns) return addColumns;
  const removes = idsOf(changes, "removeCardIds");
  if ("error" in removes) return removes;
  const moves = listOf(changes, "moveCards");
  if ("error" in moves) return moves;
  const addCards = listOf(changes, "addCards");
  if ("error" in addCards) return addCards;

  const columns: KanbanColumn[] = (("columns" in note ? note.columns : undefined) ?? []).map((column) => ({
    ...column,
    items: (column.items ?? []).map((item) => ({ ...item })),
  }));
  const columnById = (id: unknown) => columns.find((column) => column.id === id);
  const cardPlace = (id: unknown) => {
    const column = columns.find((candidate) => candidate.items.some((item) => item.id === id));
    return column && { column, index: column.items.findIndex((item) => item.id === id) };
  };
  const noCard = (id: unknown) => ({ error: `No card with the id "${String(id)}": ids come from fastmemo_read_note.` });
  const noColumn = (id: unknown) => ({ error: `No column with the id "${String(id)}": ids come from fastmemo_read_note.` });

  for (const added of addColumns.list) {
    if (!isRecord(added) || !nonBlank(added.name)) return { error: "Each column to add needs a `name`." };
    const color = columnColor(added.color, columns.length);
    if ("error" in color) return color;
    columns.push({ id: deps.newId(), name: added.name.trim(), color: color.color, items: [] });
  }
  if (columns.length > configs.notes.maxKanbanColumns) {
    return { error: `A kanban note holds up to ${configs.notes.maxKanbanColumns} columns.` };
  }

  for (const id of removes.ids) {
    const place = cardPlace(id);
    if (!place) return noCard(id);
    place.column.items.splice(place.index, 1);
  }

  for (const move of moves.list) {
    if (!isRecord(move) || typeof move.cardId !== "string" || typeof move.toColumnId !== "string") {
      return { error: "Each card to move needs its `cardId` and the `toColumnId`." };
    }
    const place = cardPlace(move.cardId);
    if (!place) return noCard(move.cardId);
    const target = columnById(move.toColumnId);
    if (!target) return noColumn(move.toColumnId);
    const [card] = place.column.items.splice(place.index, 1);
    target.items.push(card);
  }

  for (const add of addCards.list) {
    if (!isRecord(add) || typeof add.columnId !== "string" || !nonBlank(add.text)) {
      return { error: "Each card to add needs a `columnId` and its `text`." };
    }
    const column = columnById(add.columnId);
    if (!column) return noColumn(add.columnId);
    column.items.push({ id: deps.newId(), text: add.text });
  }
  return { content: { columns } };
}

function editCode(note: Note, changes: Record<string, unknown>, deps: McpDeps): Edited {
  const updates = listOf(changes, "updateTabs");
  if ("error" in updates) return updates;
  const adds = listOf(changes, "addTabs");
  if ("error" in adds) return adds;

  const tabs: CodeTab[] = (("tabs" in note ? note.tabs : undefined) ?? []).map((tab) => ({ ...tab }));

  for (const update of updates.list) {
    if (!isRecord(update) || typeof update.id !== "string") return { error: "Each tab to update needs its `id`." };
    const tab = tabs.find((candidate) => candidate.id === update.id);
    if (!tab) return { error: `No tab with the id "${update.id}": ids come from fastmemo_read_note.` };
    if (update.title === undefined && update.language === undefined && update.code === undefined) {
      return { error: `The update of tab "${update.id}" needs \`title\`, \`language\` or \`code\`.` };
    }
    if (update.title !== undefined) {
      if (!nonBlank(update.title)) return { error: "A tab's `title` can't be empty." };
      tab.title = update.title.trim();
    }
    if (update.language !== undefined) {
      const language = typeof update.language === "string" ? update.language.trim().toLowerCase() : "";
      if (!Object.hasOwn(LANGUAGE_LABELS, language))
        return { error: `"${String(update.language)}" isn't a language the editor has.` };
      tab.language = language;
    }
    if (update.code !== undefined) {
      if (typeof update.code !== "string") return { error: "A tab's `code` must be text." };
      tab.code = update.code;
    }
  }

  for (const add of adds.list) {
    if (!isRecord(add) || !nonBlank(add.title) || typeof add.code !== "string") {
      return { error: "Each tab to add needs a `title` and its `code`." };
    }
    tabs.push({
      id: deps.newId(),
      title: add.title.trim(),
      code: add.code,
      language: tabLanguage(add.language, add.title.trim()),
    });
  }
  // Tabs are never removed here, so the active one stays what it was.
  const active = "activeTabId" in note ? note.activeTabId : undefined;
  return { content: { tabs, ...(typeof active === "string" && { activeTabId: active }) } };
}

const EDITORS = { text: editText, todo: editTodo, kanban: editKanban, code: editCode };

/** The note as `changes` would leave it, or what's wrong with them. The note given is left as it was. */
export function applyEdit(note: Note, changes: EditChanges, deps: McpDeps): { note: Note } | Failure {
  const given = changes as Record<string, unknown>;
  const type: NoteType = note.type ?? "text";

  for (const [owner, fields] of Object.entries(FIELDS_OF)) {
    if (owner === type) continue;
    const wrong = fields.find((field) => present(given, field));
    if (wrong) return { error: `\`${wrong}\` is for ${owner} notes, and this is a ${type} note.` };
  }

  let title = note.title;
  if (present(given, "title")) {
    const normal = normalizeTitle(given.title);
    if ("error" in normal) return normal;
    title = normal.title;
  }

  let category = note.category;
  if (present(given, "category")) {
    if (given.category === null) {
      category = defaultCategory;
    } else if (typeof given.category === "string") {
      const found = findCategory(deps.getState().categories.items, given.category);
      if (!found) {
        return {
          error: `No category named "${given.category}". Names come from fastmemo_list_categories; null is the default category.`,
        };
      }
      category = found;
    } else {
      return { error: "`category` must be a name from fastmemo_list_categories, or null." };
    }
    // The same category the note already has stays as stored.
    if (category.name === note.category?.name && category.icon === note.category?.icon) category = note.category;
  }

  const edited = EDITORS[type](note, given, deps);
  if ("error" in edited) return edited;

  const changed = { ...note, title, category, ...edited.content } as Note;
  if (JSON.stringify(changed) === JSON.stringify(note)) return { error: NOTHING_TO_CHANGE };

  // The size as `create_note` counts it: UTF-8 bytes of the HTML, or of the content as stored. Only when the content is
  // what changed: a note already over the limit can still be renamed.
  const contentOf = (n: Note) =>
    JSON.stringify(Object.fromEntries(Object.keys(edited.content).map((key) => [key, (n as never)[key]])));
  if (contentOf(changed) !== contentOf(note)) {
    const size = typeof edited.content.text === "string" ? byteSize(edited.content.text) : byteSize(contentOf(changed));
    if (size > deps.textLimit()) return { error: "The note would be too big for Fast Memo's limit: shorten the content." };
  }
  return { note: changed };
}
