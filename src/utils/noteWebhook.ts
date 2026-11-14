import type { Note } from "@/types";

/** What the editors send the user's webhook about a note: its fields, and the content of its type. */
export function noteWebhookBody(action: string, note: Note): Record<string, unknown> {
  const content =
    note.type === "todo"
      ? { list: note.list, mode: note.mode }
      : note.type === "kanban"
        ? { columns: note.columns }
        : note.type === "code"
          ? { tabs: note.tabs, activeTabId: note.activeTabId }
          : { text: note.text };
  return {
    action,
    id: note.id,
    type: note.type,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    important: note.important,
    readOnly: note.readOnly,
    hidden: note.hidden,
    locked: note.locked,
    category: { iconId: note.category?.icon, name: note.category?.name },
    ...content,
  };
}
