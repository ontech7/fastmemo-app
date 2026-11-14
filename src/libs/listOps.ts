import { moveById } from "@/libs/reorderDrop";
import type { TodoItem } from "@/types";

/*
 * What a list note does with its items (spec B.7), pure: nothing is changed in place, the results hold the list's own
 * item objects (a row whose item didn't change doesn't render again), items are told apart by `id`.
 */

/** `item` right after the item with this id; at the end when the id isn't there. */
export function insertAfter(list: readonly TodoItem[], afterId: string, item: TodoItem): TodoItem[] {
  const at = list.findIndex((candidate) => candidate.id === afterId);
  const next = [...list];
  next.splice(at < 0 ? list.length : at + 1, 0, item);
  return next;
}

/**
 * Whether the item right under `afterId` is `freshId` and still empty: the item an Enter in `afterId` just made. A
 * hardware Enter on Android submits twice (key down and key up): the second finds it and makes no other.
 */
export function freshAfter(list: readonly TodoItem[], afterId: string, freshId: string | null): boolean {
  if (!freshId) return false;
  const next = list[list.findIndex((item) => item.id === afterId) + 1];
  return list.some((item) => item.id === afterId) && next?.id === freshId && next.text === "";
}

/**
 * Without the item. `focusId`: the nearest item above it that is visible, the nearest below when there is none above.
 * The only item stays, and so does a list that doesn't hold the id (both with a null `focusId`).
 */
export function removeItem(
  list: readonly TodoItem[],
  id: string,
  hideDone = false
): { list: TodoItem[]; focusId: string | null } {
  const at = list.findIndex((item) => item.id === id);
  if (at < 0 || list.length === 1) return { list: [...list], focusId: null };
  const shown = (item: TodoItem) => !hideDone || !item.checked;
  const above = list.slice(0, at).reverse().find(shown);
  const below = list.slice(at + 1).find(shown);
  return { list: list.filter((_, i) => i !== at), focusId: (above ?? below)?.id ?? null };
}

export function visibleItems(list: readonly TodoItem[], hideDone: boolean): TodoItem[] {
  return hideDone ? list.filter((item) => !item.checked) : [...list];
}

/**
 * The visible item `id` moved to slot `toIndex` among the visible items, counted as `moveById` (`libs/reorderDrop`) counts
 * it: with the item where it still is. The visible items take the places visible items had: hidden ones don't move. No
 * move, or an id that isn't visible, gives `list` itself.
 */
export function moveVisibleTo(list: readonly TodoItem[], id: string, toIndex: number, hideDone: boolean): TodoItem[] {
  const visible = visibleItems(list, hideDone);
  const moved = moveById(visible, id, toIndex);
  if (moved === visible) return list as TodoItem[];
  let next = 0;
  return list.map((item) => (hideDone && item.checked ? item : moved[next++]));
}

export function withoutDone(list: readonly TodoItem[]): TodoItem[] {
  return list.filter((item) => !item.checked);
}

export function doneCount(list: readonly TodoItem[]): number {
  return list.reduce((count, item) => count + (item.checked ? 1 : 0), 0);
}
