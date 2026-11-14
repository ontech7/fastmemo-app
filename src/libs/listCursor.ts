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
