/*
 * Where a dragged item lands (the reorder engine: kanban boards, lists, categories). A board is several containers (its
 * columns) side by side in a frame that scrolls sideways; a list or the categories are one container. The rectangles are
 * measured when the item is lifted, and the lifted item is taken out of them (`withoutItem`): its place closes while it
 * is in the air, and the slot it would land in opens. What moves during the drag is then only scroll (the frame sideways,
 * each container up and down), so the boxes now are those shifted by the scroll since. Pure numbers and plain objects,
 * worklets: the drag runs this on the UI thread at every move. `moveById` and `stepIndex` apply a move to one array.
 */

/** In window coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropContainer {
  id: string;
  /** The container's item area (its scroll view's box), measured at lift. */
  area: Rect;
  /** Its items in order, measured at lift (the dragged one included, where it is). */
  items: Rect[];
}

export interface DropLayout {
  /** The box everything is in (a board, a list's screen area): the drag's layer origin. */
  frame: Rect;
  containers: DropContainer[];
  /** The scroll offsets at lift: the frame's (sideways), and each container's. */
  frameScrollX: number;
  containerScrollY: number[];
}

/** The same offsets now. */
export interface DropScroll {
  frameScrollX: number;
  containerScrollY: number[];
}

export interface DropTarget {
  container: number;
  /**
   * A slot among the container's items in the layout given: without the lifted item, when the layout comes from
   * `withoutItem`. `toMoveIndex` turns it into what `moveCard` and `moveById` expect.
   */
  index: number;
}

/** How far outside the frame the pointer still counts. */
export const FRAME_SLACK = 24;

/**
 * The slot under the pointer, or null when the pointer is off the frame. The pointer picks the container; within it, the
 * slot is where `itemTop` is, the lifted item's top edge (the pointer less where it holds the item), when given: an item
 * gives up its slot once that edge passes its middle. So the drag starts in the item's own place wherever the finger
 * holds it, and moves a slot after half an item, up or down; by the pointer alone a finger a pixel below the middle of
 * the item moved it at once.
 */
export function findDrop(
  layout: DropLayout,
  scroll: DropScroll,
  pointerX: number,
  pointerY: number,
  itemTop: number = pointerY
): DropTarget | null {
  "worklet";
  const { frame, containers } = layout;
  if (containers.length === 0) return null;
  if (
    pointerX < frame.x - FRAME_SLACK ||
    pointerX > frame.x + frame.width + FRAME_SLACK ||
    pointerY < frame.y - FRAME_SLACK ||
    pointerY > frame.y + frame.height + FRAME_SLACK
  ) {
    return null;
  }

  const dx = scroll.frameScrollX - layout.frameScrollX;
  const first = containers[0].area;
  const last = containers[containers.length - 1].area;
  if (pointerX < first.x - dx || pointerX > last.x + last.width - dx) return null;

  // The container whose span holds the pointer; in a gap, the one whose edge is nearer.
  let container = 0;
  let nearest = Infinity;
  for (let c = 0; c < containers.length; c++) {
    const left = containers[c].area.x - dx;
    const right = left + containers[c].area.width;
    const distance = pointerX < left ? left - pointerX : pointerX > right ? pointerX - right : 0;
    if (distance < nearest) {
      nearest = distance;
      container = c;
    }
  }

  const { items } = containers[container];
  const dy = (scroll.containerScrollY[container] ?? 0) - (layout.containerScrollY[container] ?? 0);
  let index = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].y - dy + items[i].height / 2 < itemTop) index++;
  }
  return { container, index };
}

/**
 * The layout with item `index` of container `container` taken out, as the container shows it while that item is in the
 * air: the items after it move up by its place (from its top to the next item's top). Nothing else changes; the layout
 * given is left as it is.
 */
export function withoutItem(layout: DropLayout, container: number, index: number): DropLayout {
  "worklet";
  const source = layout.containers[container];
  if (!source || index < 0 || index >= source.items.length) return layout;
  const items = source.items;
  const step = index + 1 < items.length ? items[index + 1].y - items[index].y : 0;
  const kept: Rect[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i < index) kept.push(items[i]);
    else if (i > index) kept.push({ x: items[i].x, y: items[i].y - step, width: items[i].width, height: items[i].height });
  }
  const containers = layout.containers.slice();
  containers[container] = { id: source.id, area: source.area, items: kept };
  return {
    frame: layout.frame,
    containers,
    frameScrollX: layout.frameScrollX,
    containerScrollY: layout.containerScrollY,
  };
}

/**
 * A slot found among the items measured at lift, as a place among a container's items now. `measured` is the ids of the
 * items measured then, in order, without the lifted one; `items` the container's ids now, without it. A long list's rows
 * far from the screen aren't mounted, so they aren't measured: slot `index` is "before the measured item `index`" (or
 * "after the last measured one"), and that item's place now is where the slot goes. An item gone meanwhile (deleted on
 * another device) gives the place after the nearest measured item before it.
 */
export function slotInItems(measured: readonly string[], items: readonly string[], index: number): number {
  "worklet";
  if (index < measured.length) {
    const at = items.indexOf(measured[index]);
    if (at !== -1) return at;
  }
  for (let j = Math.min(index, measured.length) - 1; j >= 0; j--) {
    const at = items.indexOf(measured[j]);
    if (at !== -1) return at + 1;
  }
  return 0;
}

/** Whether dropping there would leave the item where it is (a target found without the item: `withoutItem`). */
export function isOwnPlace(target: DropTarget, sourceContainer: number, sourceIndex: number): boolean {
  "worklet";
  return target.container === sourceContainer && target.index === sourceIndex;
}

/**
 * The slot for `moveCard` and `moveById`, which count the item where it still is: in its own container, a slot after its
 * place is one more there.
 */
export function toMoveIndex(target: DropTarget, sourceContainer: number, sourceIndex: number): number {
  "worklet";
  return target.container === sourceContainer && target.index > sourceIndex ? target.index + 1 : target.index;
}

/**
 * `list` with item `id` moved to slot `toIndex`, counted with the item where it still is (`moveCard`'s rules on one
 * array): its own slot or the next is no move, a slot out of range is clamped. No move, or an id that isn't there (gone on
 * another device meanwhile), gives `list` itself.
 */
export function moveById<T extends { id: string }>(list: readonly T[], id: string, toIndex: number): readonly T[] {
  const from = list.findIndex((item) => item.id === id);
  if (from < 0) return list;
  let slot = Math.max(0, Math.min(Number.isFinite(toIndex) ? Math.trunc(toIndex) : list.length, list.length));
  if (slot === from || slot === from + 1) return list;
  if (slot > from) slot -= 1;
  const next = list.filter((_, i) => i !== from);
  next.splice(slot, 0, list[from]);
  return next;
}

/** The `moveById` slot that moves the item at `index` one place (up: -1, down: 1), or null at that end of the list. */
export function stepIndex(index: number, delta: -1 | 1, length: number): number | null {
  if (index < 0 || index >= length) return null;
  if (delta === -1) return index === 0 ? null : index - 1;
  return index === length - 1 ? null : index + 2;
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
