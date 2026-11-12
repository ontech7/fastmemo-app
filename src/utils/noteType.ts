/** The note types this version can open. */
const KNOWN_NOTE_TYPES: ReadonlySet<unknown> = new Set(["text", "todo", "kanban", "code"]);

/**
 * Whether this version can open a note of this type. A note with no type is a text note (older data). A note of another
 * type comes from a newer version: it is shown as such and never opened or changed here.
 */
export function isKnownNoteType(type: unknown): boolean {
  return type === undefined || type === "" || KNOWN_NOTE_TYPES.has(type);
}
