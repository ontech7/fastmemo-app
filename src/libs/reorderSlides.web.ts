import type { ViewInstance } from "react-native";

/** The prefix of the animations Reanimated makes for layout transitions on the web. */
const LAYOUT_ANIMATION = "REA-LAYOUT";

/**
 * Forgets the slides that items inside `frame` made while an item was in the air, before the drop reorders them.
 * Reanimated leaves a layout transition's animation name on the element when it ends, and its keyframes for a while
 * after; the drop moves elements in the page, and WebKit (the desktop app) plays an animation again when its element
 * moves: the cards slid a second time at the drop. Chrome doesn't.
 */
export function forgetSlides(frame: ViewInstance | null | undefined): void {
  const root = frame as unknown as HTMLElement | null | undefined;
  if (!root?.querySelectorAll) return;
  for (const element of root.querySelectorAll<HTMLElement>("[style*='animation-name']")) {
    if (element.style.animationName.startsWith(LAYOUT_ANIMATION)) element.style.animationName = "";
  }
}
