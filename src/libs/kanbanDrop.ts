/*
 * Where a dragged kanban card lands. The rectangles are measured when the card is lifted; what moves during the drag is
 * only scroll (the board sideways, each column up and down), so the boxes now are the measured ones shifted by the scroll
 * since. Pure numbers and plain objects, worklets: the drag runs this on the UI thread at every move.
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
  /** A slot in the column's cards as they are (the dragged one included): what `moveCard` expects. */
  index: number;
  line: { x: number; y: number; width: number };
}

/** The line is this much shorter than the card area on each side. */
export const LINE_INSET = 8;
/** How far outside the board the pointer still counts. */
export const BOARD_SLACK = 24;

/** Where the line goes in an empty column, below the card area's top. */
const EMPTY_LINE_OFFSET = 6;
/** How far the line sits above the first card or below the last. */
const EDGE_LINE_OFFSET = 4;

/** The slot under the pointer and where its line is drawn, or null when the pointer is off the board. */
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

  const { area, cards } = columns[column];
  const dy = (scroll.columnScrollY[column] ?? 0) - (layout.columnScrollY[column] ?? 0);
  let index = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].y - dy + cards[i].height / 2 < pointerY) index++;
  }

  let y: number;
  if (cards.length === 0) {
    y = area.y + EMPTY_LINE_OFFSET;
  } else if (index === 0) {
    y = cards[0].y - dy - EDGE_LINE_OFFSET;
  } else if (index === cards.length) {
    const lastCard = cards[cards.length - 1];
    y = lastCard.y - dy + lastCard.height + EDGE_LINE_OFFSET;
  } else {
    const above = cards[index - 1];
    const below = cards[index];
    y = (above.y + above.height + below.y) / 2 - dy;
  }
  y = Math.min(Math.max(y, area.y), area.y + area.height);

  return { column, index, line: { x: area.x - dx + LINE_INSET, y, width: area.width - 2 * LINE_INSET } };
}

/** Whether dropping there would leave the card where it is. */
export function isOwnPlace(target: DropTarget, sourceColumn: number, sourceIndex: number): boolean {
  "worklet";
  return target.column === sourceColumn && (target.index === sourceIndex || target.index === sourceIndex + 1);
}
