import type { Note } from "@/types";

/*
 * What an agent may reach. Locked and hidden are flags the UI enforces with the secret code, not encryption: this filter is
 * the only barrier here, so every tool gets at the notes through it, and an id out of reach gets the answer of one that
 * doesn't exist. "Show hidden" changes nothing: it's the user's view, behind the same secret code.
 */

export const NOT_FOUND = "No note with this id.";

export const isVisibleToAgent = (note: Note): boolean => !note.locked && !note.hidden;

export const findVisibleNote = (items: Note[], id: unknown): Note | undefined =>
  typeof id === "string" ? items.find((note) => note.id === id && isVisibleToAgent(note)) : undefined;
