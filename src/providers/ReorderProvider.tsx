import { LIFT } from "@/constants/styles";
import Haptics, { ImpactFeedbackStyle, NotificationFeedbackType } from "@/libs/haptics";
import { findDrop, isOwnPlace, slotInItems, stepIndex, toMoveIndex, withoutItem } from "@/libs/reorderDrop";
import type { DropContainer, DropLayout, DropTarget, Rect } from "@/libs/reorderDrop";
import { forgetSlides } from "@/libs/reorderSlides";
import { measureInWindow } from "@/libs/tourTargets";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Keyboard, Platform } from "react-native";
import type { ViewInstance } from "react-native";
import {
  Easing,
  useAnimatedReaction,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { LayoutAnimationFunction, SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/*
 * The reorder engine (ADR-037, ADR-038): one drag for kanban boards (several containers, the columns, side by side in a
 * frame that scrolls sideways), lists and the categories (one container). Nothing is measured until an item is lifted:
 * then the frame, every container's item area and every registered item are measured in window coordinates, once, with
 * the scroll offsets of that moment, and the lifted item is taken out of them (`withoutItem`). During the drag only the
 * scroll moves them, so the UI thread finds the target from those rectangles (`findDrop`) at every frame. JS hears when
 * the slot changes (the containers show it: the preview) and at the end, when the item settles into the slot.
 */

/** The drop lands quickly (the user, 2026-11-12: moving things in a row must not wait on it), easing out. */
const SETTLE = { duration: LIFT.dropMs, easing: Easing.out(Easing.cubic) };
/** The webview may report an animation's end late: the drag ends by then anyway. */
const SETTLE_MS = LIFT.dropMs + 60;
/** How long an item slides when the slot opens or its place closes (the kanban's `ITEM_LAYOUT`). */
const SLIDE_MS = 160;

export interface ReorderItem {
  id: string;
}

export interface ReorderContainerData<T extends ReorderItem> {
  id: string;
  items: readonly T[];
}

export interface ReorderContextValue {
  /** 1 while an item is in the air. */
  active: SharedValue<number>;
  /** 1 while the lifted item settles into its slot, at the end. */
  returning: SharedValue<number>;
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  /** Where the pointer holds the lifted item, from its top left corner. */
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  /** The lifted item's width as measured. */
  liftWidth: SharedValue<number>;
  target: SharedValue<DropTarget | null>;
  layout: SharedValue<DropLayout | null>;
  /** The frame's sideways scroll (a board); 0 where the frame doesn't scroll. */
  frameScrollX: SharedValue<number>;
  /**
   * Each container's scroll offset, by container id. By id, not by place: columns move and are deleted, and a column
   * keeps its scroll when it does.
   */
  containerScrollY: SharedValue<Record<string, number>>;
  /** The frame, the containers and the items make themselves measurable; nothing is measured until a lift. */
  registerFrame(node: RefObject<ViewInstance | null>): void;
  registerContainer(containerId: string, node: { area: RefObject<ViewInstance | null> }): () => void;
  registerItem(containerId: string, itemId: string, node: RefObject<ViewInstance | null>): () => void;
  /** The slot shown in a container: where the lifted item settles at the end. */
  registerSlot(node: RefObject<ViewInstance | null>): () => void;
  /** Called from a handle's gesture, on the JS thread. */
  lift(item: ReorderItem, containerId: string, pointerX: number, pointerY: number): void;
  /** The end of a handle's gesture: only the item's own ends its drag (another finger on another handle doesn't). */
  release(itemId: string): void;
  cancel(itemId: string): void;
  /**
   * Moves an item one place up (-1) or down (1) in its container, at once, without a drag: the keyboard's arrows and the
   * screen reader's actions. Nothing at an end, nor while an item is in the air.
   */
  move(itemId: string, containerId: string, delta: -1 | 1): void;
  /**
   * The layout transition of an item that should slide while an item is in the air but not in the commits that lift and
   * drop it, as a board's cards do, without a prop that changes on every item then (a long list's rows): the same function
   * always, which reads at each layout change whether the drag is starting or ending. A slide there drew the item that
   * opens the slot a place lower for an instant (its box slid from where it was, with the slot already in it).
   */
  itemLayout: LayoutAnimationFunction;
}

export interface ReorderDragged<T extends ReorderItem> {
  item: T;
  containerId: string;
}

/**
 * What the containers show while an item is in the air: its own place folded (the item stays mounted: its gesture is
 * running) and a slot of its height where it would land. The same order the drop then commits, so the drop moves nothing.
 */
export interface ReorderPreview {
  sourceContainerId: string;
  sourceItemId: string;
  targetContainerId: string;
  /** A slot among the target container's items without the lifted one. */
  targetIndex: number;
  height: number;
}

interface Props<T extends ReorderItem> {
  children: ReactNode;
  /** The containers and their items as they are now, read at lift only (a ref: a keystroke must not render the drag). */
  containersRef: RefObject<readonly ReorderContainerData<T>[]>;
  /**
   * Applies a drop. `toIndex` counts the item where it still is (`moveCard`, `moveById`); the caller applies it to its
   * data as it is at that moment.
   */
  onDrop: (itemId: string, fromContainerId: string, toContainerId: string, toIndex: number) => void;
}

const ReorderContext = createContext<ReorderContextValue | null>(null);
const ReorderDraggedContext = createContext<ReorderDragged<ReorderItem> | null>(null);
const ReorderPreviewContext = createContext<ReorderPreview | null>(null);
const ReorderSlidingContext = createContext(false);

/** The web has no custom layout transitions (`itemLayout`): its items slide by a prop, `useReorderSliding`. */
const isWeb = Platform.OS === "web";

const sameTarget = (a: DropTarget | null, b: DropTarget | null) => {
  "worklet";
  if (a === null || b === null) return a === b;
  return a.container === b.container && a.index === b.index;
};

export default function ReorderProvider<T extends ReorderItem>({ children, containersRef, onDrop }: Props<T>) {
  const reducedMotion = useReducedMotion();

  const active = useSharedValue(0);
  const returning = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const liftWidth = useSharedValue(0);
  const target = useSharedValue<DropTarget | null>(null);
  const layout = useSharedValue<DropLayout | null>(null);
  const frameScrollX = useSharedValue(0);
  const containerScrollY = useSharedValue<Record<string, number>>({});
  // 0 while the lift's or the drop's commit lays the items out: they take their places at once.
  const slide = useSharedValue(1);
  const itemLayout = useMemo<LayoutAnimationFunction>(
    () => (values) => {
      "worklet";
      const timing = { duration: slide.get() === 1 ? SLIDE_MS : 0 };
      return {
        initialValues: {
          originX: values.currentOriginX,
          originY: values.currentOriginY,
          width: values.currentWidth,
          height: values.currentHeight,
        },
        animations: {
          originX: withTiming(values.targetOriginX, timing),
          originY: withTiming(values.targetOriginY, timing),
          width: withTiming(values.targetWidth, timing),
          height: withTiming(values.targetHeight, timing),
        },
      };
    },
    [slide]
  );

  const [dragged, setDragged] = useState<ReorderDragged<ReorderItem> | null>(null);
  const [preview, setPreview] = useState<ReorderPreview | null>(null);
  // The items slide again once the commit that started or ended the drag is on screen (a long list takes more than a
  // frame to render it): two frames after it.
  const inAir = preview !== null;
  // The web's items slide while an item is in the air, from two frames after the lift until the drop's commit.
  const [sliding, setSliding] = useState(false);
  // A lift or a drop that starts before the last commit's slide came back keeps it off for its own commit.
  const slideGen = useRef(0);
  useEffect(() => {
    const gen = slideGen.current;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (slideGen.current !== gen) return;
        slide.set(1);
        if (isWeb) setSliding(inAir);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [inAir, slide]);
  const slotRef = useRef<RefObject<ViewInstance | null> | null>(null);

  const frameRef = useRef<RefObject<ViewInstance | null> | null>(null);
  const containerAreas = useRef(new Map<string, RefObject<ViewInstance | null>>());
  const items = useRef(new Map<string, Map<string, RefObject<ViewInstance | null>>>());
  // The drag in progress, for the JS side: which item, from where (container, index), its box at lift, and the layout
  // measured then without it.
  const dragRef = useRef<{
    item: ReorderItem;
    containerId: string;
    /** Its container's place in `lift`. */
    container: number;
    /** Its place in its container's items at lift (all of them, measured or not). */
    index: number;
    /** Per container of `lift`: the ids of the items measured at lift, without the lifted one (the targets). */
    measured: string[][];
    box: Rect;
    /**
     * Where the pointer holds the item, from its top: JS reads it here, not from `grabY`, whose `get` on JS gives the
     * UI thread's value, still the last drag's right after the `set` (the first slot came from the last drag's grab).
     */
    grabY: number;
    lift: DropLayout;
  } | null>(null);
  // A lift whose measures are still coming: a release before they arrive abandons it.
  const liftSeq = useRef(0);
  // The item whose lift is waiting for its measures: only its own handle ends it, and no other lift starts meanwhile.
  const liftingId = useRef<string | null>(null);

  const onDropRef = useRef(onDrop);
  const reducedMotionRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    onDropRef.current = onDrop;
    reducedMotionRef.current = reducedMotion;
  }, [onDrop, reducedMotion]);

  const registerFrame = useCallback((node: RefObject<ViewInstance | null>) => {
    frameRef.current = node;
  }, []);

  const registerContainer = useCallback((containerId: string, node: { area: RefObject<ViewInstance | null> }) => {
    containerAreas.current.set(containerId, node.area);
    return () => {
      if (containerAreas.current.get(containerId) === node.area) containerAreas.current.delete(containerId);
    };
  }, []);

  const registerSlot = useCallback((node: RefObject<ViewInstance | null>) => {
    slotRef.current = node;
    return () => {
      if (slotRef.current === node) slotRef.current = null;
    };
  }, []);

  const registerItem = useCallback((containerId: string, itemId: string, node: RefObject<ViewInstance | null>) => {
    let container = items.current.get(containerId);
    if (!container) {
      container = new Map();
      items.current.set(containerId, container);
    }
    container.set(itemId, node);
    return () => {
      const current = items.current.get(containerId);
      if (current?.get(itemId) === node) current.delete(itemId);
    };
  }, []);

  const finish = useCallback(() => {
    liftSeq.current++;
    liftingId.current = null;
    dragRef.current = null;
    active.set(0);
    returning.set(0);
    target.set(null);
    setDragged(null);
    setPreview(null);
  }, [active, returning, target]);

  /** A container's item ids now, without the lifted item. */
  const idsNow = useCallback(
    (containerId: string, liftedId: string) =>
      ((containersRef.current ?? []).find((c) => c.id === containerId)?.items ?? [])
        .filter((it) => it.id !== liftedId)
        .map((it) => it.id),
    [containersRef]
  );
  /** Where the lifted item is now in its container (-1: gone meanwhile, deleted on another device). */
  const sourceNow = useCallback(
    (drag: { item: ReorderItem; containerId: string }) =>
      ((containersRef.current ?? []).find((c) => c.id === drag.containerId)?.items ?? []).findIndex(
        (it) => it.id === drag.item.id
      ),
    [containersRef]
  );
  /** A target found among the measured items (`findDrop`), as a slot among the container's items now. */
  const placeOf = useCallback(
    (drag: NonNullable<typeof dragRef.current>, target: DropTarget): DropTarget => ({
      container: target.container,
      index: slotInItems(
        drag.measured[target.container] ?? [],
        idsNow(drag.lift.containers[target.container].id, drag.item.id),
        target.index
      ),
    }),
    [idsNow]
  );

  /** The slot shown: in a container, at a place among its items without the lifted one. */
  const showPlace = useCallback((targetContainerId: string, targetIndex: number) => {
    setPreview((p) =>
      !p || (p.targetContainerId === targetContainerId && p.targetIndex === targetIndex)
        ? p
        : { ...p, targetContainerId, targetIndex }
    );
  }, []);

  /** When the slot under the pointer changes (UI thread → JS): container -1 is nowhere (its own place). */
  const showTarget = useCallback(
    (container: number, index: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (container < 0) {
        const own = sourceNow(drag);
        showPlace(drag.containerId, own === -1 ? drag.index : own);
        return;
      }
      const place = placeOf(drag, { container, index });
      showPlace(drag.lift.containers[container].id, place.index);
    },
    [placeOf, showPlace, sourceNow]
  );

  // While an item is in the air (UI thread): the target under the pointer, and a haptic when the container or the slot
  // changes. JS hears of a new slot only.
  const lastTick = useSharedValue("");
  // One worklet for the provider's life: a new one each render re-registered the frame callback at every keystroke.
  const trackTarget = useCallback(() => {
    "worklet";
    if (active.get() !== 1 || returning.get() === 1) return;
    const l = layout.get();
    if (!l) return;
    const offsets = containerScrollY.get();
    const found = findDrop(
      l,
      { frameScrollX: frameScrollX.get(), containerScrollY: l.containers.map((c) => offsets[c.id] ?? 0) },
      pointerX.get(),
      pointerY.get(),
      pointerY.get() - grabY.get()
    );
    if (!sameTarget(target.get(), found)) {
      target.set(found);
      scheduleOnRN(showTarget, found ? found.container : -1, found ? found.index : 0);
    }
    const key = !found ? "" : `${found.container}:${found.index}`;
    if (key !== lastTick.get()) {
      if (key !== "") scheduleOnRN(Haptics.selectionAsync);
      lastTick.set(key);
    }
  }, [active, returning, layout, containerScrollY, frameScrollX, pointerX, pointerY, grabY, target, showTarget, lastTick]);
  const tracking = useFrameCallback(trackTarget, false);
  const setTracking = tracking.setActive;
  useAnimatedReaction(
    () => active.get(),
    (now, previous) => {
      if (now === previous) return;
      // Where the lift starts: no haptic for it.
      if (now === 1) {
        const t = target.get();
        lastTick.set(!t ? "" : `${t.container}:${t.index}`);
      }
      scheduleOnRN(setTracking, now === 1);
    }
  );

  const lift = useCallback(
    (item: ReorderItem, containerId: string, x: number, y: number) => {
      if (dragRef.current || liftingId.current || active.get() === 1) return;
      const seq = ++liftSeq.current;
      liftingId.current = item.id;
      Haptics.impactAsync(ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();

      const order = containersRef.current ?? [];
      const scrollX = frameScrollX.get();
      const scrollById = containerScrollY.get();

      const measureContainer = async (container: ReorderContainerData<T>) => {
        const area = await measureInWindow(containerAreas.current.get(container.id)?.current);
        if (!area) return null;
        const nodes = items.current.get(container.id);
        // Items not mounted (a long list's rows far from the screen) aren't measured: they are no target.
        const boxes = await Promise.all(
          container.items.map(async (it) => ({ id: it.id, box: await measureInWindow(nodes?.get(it.id)?.current) }))
        );
        const measured = boxes.filter((b): b is { id: string; box: Rect } => b.box !== null);
        return {
          container: { id: container.id, area, items: measured.map((b) => b.box) } as DropContainer,
          ids: measured.map((b) => b.id),
        };
      };

      Promise.all([measureInWindow(frameRef.current?.current), Promise.all(order.map(measureContainer))]).then(
        ([frame, measuredContainers]) => {
          // Released before the measures came, or another lift started.
          if (seq !== liftSeq.current || !frame) return;
          const kept = measuredContainers.filter((c): c is NonNullable<typeof c> => c !== null);
          const c = kept.findIndex((m) => m.container.id === containerId);
          const i = c === -1 ? -1 : kept[c].ids.indexOf(item.id);
          // The dragged item itself can't be measured: no drag.
          if (c === -1 || i === -1) {
            liftSeq.current++;
            liftingId.current = null;
            return;
          }

          const measured: DropLayout = {
            frame,
            containers: kept.map((m) => m.container),
            frameScrollX: scrollX,
            containerScrollY: kept.map((m) => scrollById[m.container.id] ?? 0),
          };
          const box = measured.containers[c].items[i];
          // The lifted item's place closes while it is in the air: the target is found among the others.
          const dropLayout = withoutItem(measured, c, i);
          const grab = y - box.y;
          const own = (order.find((o) => o.id === containerId)?.items ?? []).findIndex((it) => it.id === item.id);
          const drag = {
            item,
            containerId,
            container: c,
            index: own === -1 ? i : own,
            measured: kept.map((m) => m.ids.filter((id) => id !== item.id)),
            box,
            grabY: grab,
            lift: dropLayout,
          };
          dragRef.current = drag;
          liftingId.current = null;

          layout.set(dropLayout);
          grabX.set(x - box.x);
          grabY.set(grab);
          liftWidth.set(box.width);
          // The pointer is the gesture's: it wrote it at activation and keeps writing it while the measures come.
          const first = findDrop(
            dropLayout,
            { frameScrollX: scrollX, containerScrollY: dropLayout.containerScrollY },
            pointerX.get(),
            pointerY.get(),
            pointerY.get() - grab
          );
          target.set(first);
          const firstPlace = first ? placeOf(drag, first) : null;
          // The commit that starts the drag folds the item's place and opens the slot there: nothing moves, no slide.
          slideGen.current++;
          slide.set(0);
          setDragged({ item, containerId });
          setPreview({
            sourceContainerId: containerId,
            sourceItemId: item.id,
            targetContainerId: firstPlace ? dropLayout.containers[firstPlace.container].id : containerId,
            targetIndex: firstPlace ? firstPlace.index : drag.index,
            height: box.height,
          });
          active.set(1);
        }
      );
    },
    [
      active,
      containersRef,
      frameScrollX,
      containerScrollY,
      layout,
      grabX,
      grabY,
      liftWidth,
      pointerX,
      pointerY,
      target,
      placeOf,
      slide,
    ]
  );

  // A lift closes the keyboard, and the frame and the containers were measured while it was still up: when it is gone
  // they are taller (the list reaches down to where the keyboard was), and the rows there are targets and the edge scroll
  // is at the new bottom. The items didn't move: their rectangles stay.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      const drag = dragRef.current;
      if (!drag) return;
      const seq = liftSeq.current;
      Promise.all([
        measureInWindow(frameRef.current?.current),
        Promise.all(drag.lift.containers.map((c) => measureInWindow(containerAreas.current.get(c.id)?.current))),
      ]).then(([frame, areas]) => {
        if (seq !== liftSeq.current || dragRef.current !== drag || !frame) return;
        const remeasured: DropLayout = {
          ...drag.lift,
          frame,
          containers: drag.lift.containers.map((c, k) => (areas[k] ? { ...c, area: areas[k] } : c)),
        };
        drag.lift = remeasured;
        layout.set(remeasured);
      });
    });
    return () => subscription.remove();
  }, [layout]);

  /**
   * The end of every drag: the lifted item eases into the slot the containers show (measured now: the frame or its
   * container may have scrolled), then `done` runs, once, and only for this drag. Without motion, at once.
   */
  const settle = useCallback(
    (done: () => void) => {
      const seq = liftSeq.current;
      const once = () => {
        if (liftSeq.current !== seq) return;
        // The commit that ends the drag lays the items out where they land: no slide (back after it: below).
        slideGen.current++;
        slide.set(0);
        if (isWeb) setSliding(false);
        forgetSlides(frameRef.current?.current);
        done();
      };
      if (reducedMotionRef.current) {
        once();
        return;
      }
      returning.set(1);
      // One frame: the slot is laid out where the last target put it.
      requestAnimationFrame(() => {
        measureInWindow(slotRef.current?.current).then((slot) => {
          if (liftSeq.current !== seq) return;
          if (!slot) {
            once();
            return;
          }
          // The drag ends when the item is in the slot, or after SETTLE_MS, whichever comes first.
          setTimeout(once, SETTLE_MS);
          pointerX.set(withTiming(slot.x + grabX.get(), SETTLE));
          pointerY.set(
            withTiming(slot.y + grabY.get(), SETTLE, () => {
              "worklet";
              scheduleOnRN(once);
            })
          );
        });
      });
    },
    [returning, pointerX, pointerY, grabX, grabY, slide]
  );

  const release = useCallback(
    (itemId: string) => {
      const drag = dragRef.current;
      if (!drag) {
        // Released before the lift's measures came: no drag. Another handle's finger leaves it alone.
        if (liftingId.current === itemId) finish();
        return;
      }
      if (drag.item.id !== itemId) return;
      if (returning.get() === 1) return;
      const dropLayout = drag.lift;
      const scrollById = containerScrollY.get();
      // The target as of the release, not as of the last frame.
      const now = findDrop(
        dropLayout,
        {
          frameScrollX: frameScrollX.get(),
          containerScrollY: dropLayout.containers.map((c) => scrollById[c.id] ?? 0),
        },
        pointerX.get(),
        pointerY.get(),
        pointerY.get() - drag.grabY
      );
      // Measured slots are places among the items as they are now (rows not mounted at lift, another device's edits).
      const own = sourceNow(drag);
      const place = now !== null && own !== -1 ? placeOf(drag, now) : null;
      const moves = place !== null && !isOwnPlace(place, drag.container, own);
      if (place && moves) showPlace(dropLayout.containers[place.container].id, place.index);
      else showPlace(drag.containerId, own === -1 ? drag.index : own);
      settle(() => {
        if (place && moves) {
          // In the same React commit as the end of the preview: the order it showed becomes the data's.
          onDropRef.current(
            drag.item.id,
            drag.containerId,
            dropLayout.containers[place.container].id,
            toMoveIndex(place, drag.container, own)
          );
          Haptics.notificationAsync(NotificationFeedbackType.Success);
        }
        finish();
      });
    },
    [finish, settle, showPlace, placeOf, sourceNow, returning, frameScrollX, containerScrollY, pointerX, pointerY]
  );

  const cancel = useCallback(
    (itemId: string) => {
      const drag = dragRef.current;
      if (!drag) {
        if (liftingId.current === itemId) finish();
        return;
      }
      if (drag.item.id !== itemId || returning.get() === 1) return;
      showTarget(-1, drag.index);
      settle(finish);
    },
    [finish, settle, showTarget, returning]
  );

  const move = useCallback(
    (itemId: string, containerId: string, delta: -1 | 1) => {
      if (dragRef.current || liftingId.current || active.get() === 1) return;
      const container = (containersRef.current ?? []).find((c) => c.id === containerId);
      if (!container) return;
      const index = container.items.findIndex((it) => it.id === itemId);
      const toIndex = stepIndex(index, delta, container.items.length);
      if (toIndex === null) return;
      forgetSlides(frameRef.current?.current);
      onDropRef.current(itemId, containerId, containerId, toIndex);
      Haptics.notificationAsync(NotificationFeedbackType.Success);
    },
    [active, containersRef]
  );

  // Never changes for the provider's life: every item and container reads it without rendering again.
  const value = useMemo<ReorderContextValue>(
    () => ({
      active,
      returning,
      pointerX,
      pointerY,
      grabX,
      grabY,
      liftWidth,
      target,
      layout,
      frameScrollX,
      containerScrollY,
      registerFrame,
      registerContainer,
      registerItem,
      registerSlot,
      lift,
      release,
      cancel,
      move,
      itemLayout,
    }),
    [
      active,
      returning,
      pointerX,
      pointerY,
      grabX,
      grabY,
      liftWidth,
      target,
      layout,
      frameScrollX,
      containerScrollY,
      registerFrame,
      registerContainer,
      registerItem,
      registerSlot,
      lift,
      release,
      cancel,
      move,
      itemLayout,
    ]
  );

  return (
    <ReorderContext.Provider value={value}>
      <ReorderDraggedContext.Provider value={dragged}>
        <ReorderPreviewContext.Provider value={preview}>
          <ReorderSlidingContext.Provider value={sliding}>{children}</ReorderSlidingContext.Provider>
        </ReorderPreviewContext.Provider>
      </ReorderDraggedContext.Provider>
    </ReorderContext.Provider>
  );
}

export function useReorder(): ReorderContextValue {
  const context = useContext(ReorderContext);
  if (!context) {
    throw new Error("useReorder must be used within a ReorderProvider");
  }
  return context;
}

/** The item in the air and its container, or null. Changes at lift and drop: read by the overlay and the frame only. */
export function useReorderDragged<T extends ReorderItem>(): ReorderDragged<T> | null {
  return useContext(ReorderDraggedContext) as ReorderDragged<T> | null;
}

/**
 * Whether the items should slide now (web): true while an item is in the air, but not in the commits that lift and drop
 * it. Always false elsewhere, where `itemLayout` does it without rendering the items.
 */
export function useReorderSliding(): boolean {
  return useContext(ReorderSlidingContext);
}

/** The order the containers show while an item is in the air, or null. Changes at lift, when the slot moves, at the end. */
export function useReorderPreview(): ReorderPreview | null {
  return useContext(ReorderPreviewContext);
}
