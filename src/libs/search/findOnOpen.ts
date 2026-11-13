/** What a search result hands to the note it opens: the word to show in its find bar, and for code the tab it is in. */
export interface FindOnOpen {
  word: string;
  tabId?: string;
}

/**
 * One slot, in memory. The word never goes in the route: a route can end up in an error report, and a typed word must
 * not.
 */
let slot: { noteId: string; find: FindOnOpen } | null = null;

export function setFindOnOpen(noteId: string, find: FindOnOpen): void {
  slot = { noteId, find };
}

/** What was set for this note, once: the slot is emptied whatever the id asked. */
export function takeFindOnOpen(noteId: string): FindOnOpen | null {
  const taken = slot;
  slot = null;
  return taken && taken.noteId === noteId ? taken.find : null;
}
