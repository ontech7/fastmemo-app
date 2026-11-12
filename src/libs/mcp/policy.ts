import type { Note } from "@/types";
import { isKnownNoteType } from "@/utils/noteType";

/*
 * What an agent may reach. Locked and hidden are flags the UI enforces with the secret code, not encryption: this filter is
 * the only barrier here, so every tool gets at the notes through it, and an id out of reach gets the answer of one that
 * doesn't exist. "Show hidden" changes nothing: it's the user's view, behind the same secret code. A note of a type this
 * version can't open doesn't exist for an agent either: nothing here knows how to read or change it.
 */

export const NOT_FOUND = "No note with this id.";

export const isVisibleToAgent = (note: Note): boolean => !note.locked && !note.hidden && isKnownNoteType(note.type);

export const findVisibleNote = (items: Note[], id: unknown): Note | undefined =>
  typeof id === "string" ? items.find((note) => note.id === id && isVisibleToAgent(note)) : undefined;
