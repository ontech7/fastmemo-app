import type { Note } from "@/types";

import { fold } from "./fold";

/** How many notes the picker of a link to a note lists. */
export const PICK_MAX = 5;

/**
 * Up to `max` notes whose title holds `query` (folded: no case, no accents; an empty query matches every note), in the
 * order given. Never the note being edited, nor a hidden one while hidden notes aren't shown.
 */
export function pickNotes(
  notes: readonly Note[],
  query: string,
  opts: { excludeId: string; showHidden: boolean; max?: number }
): Note[] {
  const max = opts.max ?? PICK_MAX;
  const wanted = fold(query.normalize("NFC").trim());
  const picked: Note[] = [];
  for (const note of notes) {
    if (picked.length >= max) break;
    if (note.id === opts.excludeId || (note.hidden && !opts.showHidden)) continue;
    if (!wanted || fold((note.title ?? "").normalize("NFC")).includes(wanted)) picked.push(note);
  }
  return picked;
}
