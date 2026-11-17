import type { Ordered, Timestamped } from "@/types";

export const createdAt_asc_sort = (a: Timestamped, b: Timestamped): number => a.createdAt - b.createdAt;

export const createdAt_desc_sort = (a: Timestamped, b: Timestamped): number => b.createdAt - a.createdAt;

export const updatedAt_asc_sort = (a: Timestamped, b: Timestamped): number => a.updatedAt - b.updatedAt;

export const updatedAt_desc_sort = (a: Timestamped, b: Timestamped): number => b.updatedAt - a.updatedAt;

export const order_asc_sort = (a: Ordered, b: Ordered): number => a.order - b.order;

/**
 * The categories' order: `order`, then the icon. Two devices that reorder close together can give two categories the
 * same `order`: they sort the same way everywhere (the slice, a full sync, every list of them).
 */
export const category_order_sort = (a: { order?: number; icon: string }, b: { order?: number; icon: string }): number =>
  (a.order ?? 0) - (b.order ?? 0) || a.icon.localeCompare(b.icon);

/**
 * The categories as a list shows them: "All" (the index category) first whatever its `order`, then the others by
 * `category_order_sort`. Stored data can give another category the same or a lower `order` (from a sync or an import):
 * "All" still leads, as on the Organize page.
 */
export function categoriesInOrder<T extends { index?: boolean; order?: number; icon: string }>(categories: readonly T[]): T[] {
  const sorted = [...categories].sort(category_order_sort);
  return sorted.filter((category) => category.index).concat(sorted.filter((category) => !category.index));
}

/** The notes `keep` accepts, important ones first, each group in the order it came in. One pass. */
export function importantFirst<T extends { important?: boolean }>(notes: readonly T[], keep: (note: T) => boolean): T[] {
  const important: T[] = [];
  const others: T[] = [];
  for (const note of notes) {
    if (keep(note)) (note.important ? important : others).push(note);
  }
  return important.concat(others);
}
