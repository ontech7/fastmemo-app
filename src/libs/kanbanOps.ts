import type { KanbanColumn } from "@/types";

/**
 * Moves a card to slot `toIndex` of `toColumnId` (a slot counted in the target's cards as they are before the move,
 * 0..length, clamped). Returns `columns` itself when nothing changes: the card isn't in `fromColumnId`, the target column
 * doesn't exist, or the card is already there. A board operation that can't complete gives back the board it got: a card
 * is never taken out before its place is known (LL-078).
 */
export function moveCard(
  columns: KanbanColumn[],
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): KanbanColumn[] {
  const from = columns.findIndex((column) => column.id === fromColumnId);
  const to = columns.findIndex((column) => column.id === toColumnId);
  if (from < 0 || to < 0) return columns;

  const fromItems = columns[from].items ?? [];
  const cardIndex = fromItems.findIndex((item) => item.id === cardId);
  if (cardIndex < 0) return columns;
  const card = fromItems[cardIndex];

  const targetLength = (columns[to].items ?? []).length;
  let slot = Math.max(0, Math.min(Number.isFinite(toIndex) ? Math.trunc(toIndex) : targetLength, targetLength));

  if (from === to) {
    // Slot i or i + 1 of the card at index i is where it already is.
    if (slot === cardIndex || slot === cardIndex + 1) return columns;
    // Taken out first, a later slot moves up by one.
    if (slot > cardIndex) slot -= 1;
    const items = fromItems.filter((item) => item.id !== cardId);
    items.splice(slot, 0, card);
    return columns.map((column, i) => (i === from ? { ...column, items } : column));
  }

  const fromNext = fromItems.filter((item) => item.id !== cardId);
  const toNext = [...(columns[to].items ?? [])];
  toNext.splice(slot, 0, card);
  return columns.map((column, i) =>
    i === from ? { ...column, items: fromNext } : i === to ? { ...column, items: toNext } : column
  );
}
