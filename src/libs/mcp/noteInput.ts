import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import { inferLanguageFromTitle, LANGUAGE_LABELS } from "@/constants/code-languages";
import { KANBAN_COLUMN_COLORS } from "@/constants/styles";
import type { McpDeps } from "@/libs/mcp/handlers";
import type { Category, Note } from "@/types";
import type { CodeTab, KanbanColumn, NoteType, TodoItem } from "@/types/note";

/*
 * A note as an agent describes it, made into one the app stores. What comes from outside is checked here, never trusted:
 * the agent doesn't choose the id, the dates, `hidden`, `local` or the revision.
 */

export const MAX_TITLE = 100;

export type Built = { note: Note } | { error: string };

/** The language a code editor starts a new tab with (`app/notes/[noteId].tsx`). */
const DEFAULT_LANGUAGE = "javascript";

const NOTE_TYPES: readonly NoteType[] = ["text", "todo", "code", "kanban"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const byteSize = (text: string): number => new TextEncoder().encode(text).length;

/** A title as the list shows it: one line, trimmed, 1 to `MAX_TITLE` characters (emoji count as one). */
export function normalizeTitle(raw: unknown): { title: string } | { error: string } {
  if (typeof raw !== "string") return { error: "`title` is required, as text." };
  const title = raw.replace(/[\r\n]+/g, " ").trim();
  if (!title) return { error: "`title` can't be empty." };
  if (Array.from(title).length > MAX_TITLE) return { error: `\`title\` is over ${MAX_TITLE} characters: shorten it.` };
  return { title };
}

/** The category with this name: exact, then ignoring case. The default category ("All") isn't one to choose. Never a near match. */
export function findCategory(categories: Category[], name: unknown): Category | undefined {
  if (typeof name !== "string") return undefined;
  const choices = categories.filter((category) => category.icon !== "none");
  const lower = name.toLowerCase();
  return (
    choices.find((category) => category.name === name) ?? choices.find((category) => category.name.toLowerCase() === lower)
  );
}

/** An optional true/false from an agent: `undefined` for absent (or null), an error for anything else. */
export function booleanFlag(args: Record<string, unknown>, name: string): { value: boolean | undefined } | { error: string } {
  const value = args[name];
  if (value === undefined || value === null) return { value: undefined };
  if (typeof value !== "boolean") return { error: `\`${name}\` must be true or false.` };
  return { value };
}

const needs = (field: string, what: string): { error: string } => ({ error: `${what} needs \`${field}\`.` });

type Content = { error: string } | { content: Record<string, unknown> };

function todoContent(args: Record<string, unknown>, deps: McpDeps): Content {
  if (!Array.isArray(args.items)) return needs("items", "A todo note");
  const list: TodoItem[] = [];
  for (const item of args.items) {
    if (!isRecord(item) || typeof item.text !== "string") return { error: "Each todo item needs `text`." };
    if (item.checked !== undefined && typeof item.checked !== "boolean")
      return { error: "A todo item's `checked` must be true or false." };
    if (item.text.trim()) list.push({ id: deps.newId(), text: item.text, checked: item.checked === true });
  }
  return list.length ? { content: { list } } : needs("items", "A todo note");
}

function kanbanContent(args: Record<string, unknown>, deps: McpDeps): Content {
  if (!Array.isArray(args.columns) || !args.columns.length) return needs("columns", "A kanban note");
  if (args.columns.length > configs.notes.maxKanbanColumns) {
    return { error: `A kanban note holds up to ${configs.notes.maxKanbanColumns} columns.` };
  }
  const columns: KanbanColumn[] = [];
  for (const [index, column] of args.columns.entries()) {
    if (!isRecord(column) || typeof column.name !== "string" || !column.name.trim())
      return { error: "Each column needs a `name`." };
    let color: string = KANBAN_COLUMN_COLORS[index % KANBAN_COLUMN_COLORS.length];
    if (column.color !== undefined && column.color !== null) {
      const known =
        typeof column.color === "string"
          ? KANBAN_COLUMN_COLORS.find((c) => c.toLowerCase() === (column.color as string).toLowerCase())
          : undefined;
      if (!known)
        return { error: `A column's \`color\` must be one of: ${KANBAN_COLUMN_COLORS.join(", ")}. Omit it for the default.` };
      color = known;
    }
    const cards = column.cards ?? [];
    if (!Array.isArray(cards) || cards.some((card) => typeof card !== "string"))
      return { error: "A column's `cards` must be a list of text." };
    columns.push({
      id: deps.newId(),
      name: column.name.trim(),
      color,
      items: (cards as string[]).filter((card) => card.trim()).map((card) => ({ id: deps.newId(), text: card })),
    });
  }
  return { content: { columns } };
}

function codeContent(args: Record<string, unknown>, deps: McpDeps): Content {
  if (!Array.isArray(args.tabs) || !args.tabs.length) return needs("tabs", "A code note");
  const tabs: CodeTab[] = [];
  for (const tab of args.tabs) {
    if (!isRecord(tab) || typeof tab.title !== "string" || !tab.title.trim() || typeof tab.code !== "string") {
      return { error: "Each tab needs a `title` and its `code`." };
    }
    const given = typeof tab.language === "string" ? tab.language.trim().toLowerCase() : "";
    const language = Object.hasOwn(LANGUAGE_LABELS, given)
      ? given
      : (inferLanguageFromTitle(tab.title.trim()) ?? DEFAULT_LANGUAGE);
    tabs.push({ id: deps.newId(), title: tab.title.trim(), code: tab.code, language });
  }
  return { content: { tabs, activeTabId: tabs[0].id } };
}

function textContent(args: Record<string, unknown>, deps: McpDeps): Content {
  if (typeof args.text !== "string" || !args.text.trim()) return needs("text", "A text note");
  const text = deps.sanitize(args.text);
  return text.trim() ? { content: { text } } : needs("text", "A text note");
}

/** Builds the note an agent asked for, or says what's wrong with the request. Nothing is stored or sent. */
export function buildNote(args: Record<string, unknown>, deps: McpDeps): Built {
  const type = args.type;
  if (typeof type !== "string" || !NOTE_TYPES.includes(type as NoteType)) {
    return { error: `\`type\` must be one of: ${NOTE_TYPES.join(", ")}.` };
  }

  const title = normalizeTitle(args.title);
  if ("error" in title) return title;

  const flags: Record<string, boolean> = {};
  for (const name of ["important", "readOnly", "locked"]) {
    const flag = booleanFlag(args, name);
    if ("error" in flag) return flag;
    // false is "not set" here: only `set_note_flags` refuses it.
    flags[name] = flag.value === true;
  }

  if (args.category !== undefined && args.category !== null && typeof args.category !== "string") {
    return { error: "`category` must be a name from fastmemo_list_categories." };
  }

  const build = { text: textContent, todo: todoContent, kanban: kanbanContent, code: codeContent }[type as NoteType];
  const built = build(args, deps);
  if ("error" in built) return built;
  const { content } = built;

  // What counts is the text as stored (UTF-8 bytes of the HTML), and for the other types their content as stored.
  const size = typeof content.text === "string" ? byteSize(content.text) : byteSize(JSON.stringify(content));
  if (size > deps.textLimit()) return { error: "The note is too big for Fast Memo's limit: shorten the content." };

  const now = deps.now();
  const note = {
    id: deps.newId(),
    type,
    title: title.title,
    category: findCategory(deps.getState().categories.items, args.category) ?? defaultCategory,
    date: deps.date(),
    createdAt: now,
    // 1 ms after createdAt, as for a quick note: equal times mark a brand-new note, which the editor autofocuses and
    // fires the add webhook for again (`QuickNoteBar.tsx`).
    updatedAt: now + 1,
    important: flags.important,
    locked: flags.locked,
    readOnly: flags.readOnly,
    hidden: false,
    deleteDate: null,
    ...content,
  } as Note;
  return { note };
}
