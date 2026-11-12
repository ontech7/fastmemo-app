import type { ViewInstance } from "react-native";

/**
 * Forgets the slides that items inside `frame` made while an item was in the air, before the drop reorders them. Only
 * the web needs it (`reorderSlides.web.ts`): phones lay the drop out with no slide (`itemLayout`).
 */
export function forgetSlides(_frame: ViewInstance | null | undefined): void {}
