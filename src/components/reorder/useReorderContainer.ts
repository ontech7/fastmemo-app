import { edgeStep } from "@/libs/reorderDrop";
import { useReorder } from "@/providers/ReorderProvider";
import { useCallback, useEffect, type RefObject } from "react";
import type { LayoutChangeEvent, ViewInstance } from "react-native";
import {
  scrollTo,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** Held this close to the top or bottom of a container's area, an item scrolls it. */
const EDGE = 40;
/** At most this many pixels per second, faster the closer to the edge (10 per frame at 60 Hz). */
const MAX_SPEED = 600;

interface Options {
  /** The container's scroll view (an Animated.ScrollView or Animated.FlatList). */
  scrollRef: AnimatedRef<any>;
  /** The view whose box is the container's area (around the scroll view): measured at lift. */
  areaRef: RefObject<ViewInstance | null>;
  edge?: number;
  maxSpeed?: number;
}

/**
 * A vertical container of the reorder engine (a board's column, a list, the categories): it registers its area, tells
 * the engine its scroll offset, and scrolls near its top or bottom edge while the target is in it (UI thread). The scroll
 * view takes `onScroll={scrollHandler}` and `onContentSizeChange`; the area view takes `onLayout`.
 */
export function useReorderContainer(containerId: string, { scrollRef, areaRef, edge = EDGE, maxSpeed = MAX_SPEED }: Options) {
  const { active, target, layout, pointerY, containerScrollY, registerContainer } = useReorder();

  useEffect(() => registerContainer(containerId, { area: areaRef }), [registerContainer, containerId, areaRef]);

  const scrollHandler = useAnimatedScrollHandler(
    (event) => {
      containerScrollY.modify((offsets) => {
        "worklet";
        offsets[containerId] = event.contentOffset.y;
        return offsets;
      });
    },
    [containerId]
  );
  const contentHeight = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const onContentSizeChange = useCallback((_: number, h: number) => contentHeight.set(h), [contentHeight]);
  const onLayout = useCallback((e: LayoutChangeEvent) => viewHeight.set(e.nativeEvent.layout.height), [viewHeight]);

  /** The pointer's height inside the area (clamped), or null when it is well outside it. */
  const pointerYIn = (top: number, height: number) => {
    "worklet";
    const y = pointerY.get() - top;
    return y < -edge || y > height + edge ? null : Math.min(Math.max(y, 0), height);
  };

  const autoScroll = useFrameCallback((frame) => {
    const t = target.get();
    const l = layout.get();
    if (active.get() !== 1 || !t || !l || l.containers[t.container]?.id !== containerId) return;
    const area = l.containers[t.container].area;
    const y = pointerYIn(area.y, area.height);
    if (y === null) return;
    const now = containerScrollY.get()[containerId] ?? 0;
    const max = Math.max(0, contentHeight.get() - viewHeight.get());
    let next = now;
    const ms = frame.timeSincePreviousFrame;
    if (y < edge) next = Math.max(0, now - edgeStep(y, edge, maxSpeed, ms));
    else if (y > area.height - edge) next = Math.min(max, now + edgeStep(area.height - y, edge, maxSpeed, ms));
    if (next !== now) scrollTo(scrollRef, 0, next, false);
  }, false);
  const setAutoScroll = autoScroll.setActive;
  useAnimatedReaction(
    () => active.get(),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setAutoScroll, now === 1);
    }
  );

  return { scrollHandler, onContentSizeChange, onLayout };
}
