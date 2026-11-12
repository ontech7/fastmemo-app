/*
 * Where a dragged kanban card lands. The rectangles are measured when the card is lifted, and the lifted card is taken
 * out of them (`withoutCard`): its place closes while it is in the air, and the slot it would land in opens. What moves
 * during the drag is then only scroll (the board sideways, each column up and down), so the boxes now are those shifted
 * by the scroll since. Pure numbers and plain objects, worklets: the drag runs this on the UI thread at every move.
 */

/** In window coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropColumn {
  id: string;
  /** The column's card area (its scroll view's box), measured at lift. */
  area: Rect;
  /** Its cards in order, measured at lift (the dragged one included, where it is). */
  cards: Rect[];
}

export interface DropLayout {
  /** The board's box. */
  board: Rect;
  columns: DropColumn[];
  /** The scroll offsets at lift: the board's, and each column's. */
  boardScrollX: number;
  columnScrollY: number[];
}

/** The same offsets now. */
export interface DropScroll {
  boardScrollX: number;
  columnScrollY: number[];
}

export interface DropTarget {
  column: number;
  /**
   * A slot among the column's cards in the layout given: without the lifted card, when the layout comes from
   * `withoutCard`. `toMoveIndex` turns it into what `moveCard` expects.
   */
  index: number;
}

/** How far outside the board the pointer still counts. */
export const BOARD_SLACK = 24;

/** The slot under the pointer, or null when the pointer is off the board. */
export function findDrop(layout: DropLayout, scroll: DropScroll, pointerX: number, pointerY: number): DropTarget | null {
  "worklet";
  const { board, columns } = layout;
  if (columns.length === 0) return null;
  if (
    pointerX < board.x - BOARD_SLACK ||
    pointerX > board.x + board.width + BOARD_SLACK ||
    pointerY < board.y - BOARD_SLACK ||
    pointerY > board.y + board.height + BOARD_SLACK
  ) {
    return null;
  }

  const dx = scroll.boardScrollX - layout.boardScrollX;
  const first = columns[0].area;
  const last = columns[columns.length - 1].area;
  if (pointerX < first.x - dx || pointerX > last.x + last.width - dx) return null;

  // The column whose span holds the pointer; in a gap, the one whose edge is nearer.
  let column = 0;
  let nearest = Infinity;
  for (let c = 0; c < columns.length; c++) {
    const left = columns[c].area.x - dx;
    const right = left + columns[c].area.width;
    const distance = pointerX < left ? left - pointerX : pointerX > right ? pointerX - right : 0;
    if (distance < nearest) {
      nearest = distance;
      column = c;
    }
  }

  const { cards } = columns[column];
  const dy = (scroll.columnScrollY[column] ?? 0) - (layout.columnScrollY[column] ?? 0);
  let index = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].y - dy + cards[i].height / 2 < pointerY) index++;
  }
  return { column, index };
}

/**
 * The layout with card `index` of column `column` taken out, as the column shows it while that card is in the air: the
 * cards after it move up by its place (from its top to the next card's top). Nothing else changes; the layout given is
 * left as it is.
 */
export function withoutCard(layout: DropLayout, column: number, index: number): DropLayout {
  "worklet";
  const source = layout.columns[column];
  if (!source || index < 0 || index >= source.cards.length) return layout;
  const cards = source.cards;
  const step = index + 1 < cards.length ? cards[index + 1].y - cards[index].y : 0;
  const kept: Rect[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (i < index) kept.push(cards[i]);
    else if (i > index) kept.push({ x: cards[i].x, y: cards[i].y - step, width: cards[i].width, height: cards[i].height });
  }
  const columns = layout.columns.slice();
  columns[column] = { id: source.id, area: source.area, cards: kept };
  return { board: layout.board, columns, boardScrollX: layout.boardScrollX, columnScrollY: layout.columnScrollY };
}

/** Whether dropping there would leave the card where it is (a target found without the card: `withoutCard`). */
export function isOwnPlace(target: DropTarget, sourceColumn: number, sourceIndex: number): boolean {
  "worklet";
  return target.column === sourceColumn && target.index === sourceIndex;
}

/**
 * The slot for `moveCard`, which counts the card where it still is: in its own column, a slot after its place is one
 * more there.
 */
export function toMoveIndex(target: DropTarget, sourceColumn: number, sourceIndex: number): number {
  "worklet";
  return target.column === sourceColumn && target.index > sourceIndex ? target.index + 1 : target.index;
}

/** A 60 Hz frame: what a frame counts when its length isn't known (the first one). */
const FRAME_MS = 1000 / 60;
/** The most one frame counts: a stalled frame doesn't turn into a jump. */
const MAX_FRAME_MS = 50;

/**
 * How far an edge scroll moves in one frame. `inside` is the pointer's distance from the edge (0 or less: at it or past
 * it); within `edge` of it the speed grows linearly to `maxPerSecond`. It is measured by the frame's real length
 * (`timeSincePreviousFrame`), so a 120 Hz screen scrolls as fast as a 60 Hz one.
 */
export function edgeStep(inside: number, edge: number, maxPerSecond: number, frameMs: number | null | undefined): number {
  "worklet";
  if (inside >= edge) return 0;
  const closeness = 1 - Math.max(inside, 0) / edge;
  const ms = Math.min(Math.max(frameMs ?? FRAME_MS, 0), MAX_FRAME_MS);
  return (maxPerSecond * closeness * ms) / 1000;
}
