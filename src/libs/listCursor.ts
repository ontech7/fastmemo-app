/*
 * The desktop list's keyboard mark, as pure steps over the ids on screen (in their order). The mark lives in
 * `@/libs/desktopList`; this only says where it goes.
 */

/**
 * Where the mark goes. With no mark, down gives the first id and up gives null; up from the first gives "field". A mark on
 * a note that is no longer listed counts as sitting above the first note.
 */
export function stepCursor(ids: readonly string[], current: string | null, direction: "up" | "down"): string | "field" | null {
  if (current === null) return direction === "down" ? (ids[0] ?? null) : null;
  const at = ids.indexOf(current);
  if (direction === "up") return at <= 0 ? "field" : ids[at - 1];
  if (at < 0) return ids[0] ?? null;
  return ids[Math.min(at + 1, ids.length - 1)];
}

/** The ids from `anchorId` to `id`, both included, in the list's order; just `id` when the anchor isn't in the list. */
export function rangeBetween(ids: readonly string[], anchorId: string | null, id: string): string[] {
  const end = ids.indexOf(id);
  if (end < 0) return [];
  const start = anchorId === null ? -1 : ids.indexOf(anchorId);
  if (start < 0) return [id];
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/**
 * What a right click acts on (spec C.2): the selection when the note is in it, however many it holds (acting on one
 * selected note alone would leave its old key in the selection once a flag changes it); otherwise that note alone.
 */
export function menuTargets(selected: string[], key: string): { ids: string[]; onSelection: boolean } {
  const onSelection = selected.includes(key);
  return { ids: onSelection ? selected : [key], onSelection };
}

/**
 * The selection limited to the notes on screen ("id|locked" keys, ids listed): a search that leaves a selected note out
 * drops it, since the selection bar acts on what is selected. The same array when nothing is dropped.
 */
export function keepOnScreen(selected: string[], ids: readonly string[]): string[] {
  const shown = new Set(ids);
  const kept = selected.filter((key) => shown.has(key.split("|")[0]));
  return kept.length === selected.length ? selected : kept;
}

/**
 * The selection once notes are trashed ("id|locked" keys): one note trashed from outside it (Delete on the mark, the
 * right-click menu) leaves it as it is, one of its own leaves the others; select mode ends once nothing is left selected.
 */
export function selectionAfterTrash(selected: string[], trashed: readonly string[]): { selected: string[]; endMode: boolean } {
  const left = selected.filter((key) => !trashed.includes(key));
  const kept = left.length === selected.length ? selected : left;
  return { selected: kept, endMode: selected.length > 0 && kept.length === 0 };
}
