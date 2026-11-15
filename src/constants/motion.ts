import { Easing } from "react-native-reanimated";

/**
 * The app's motion (spec 5.1): every transition takes one of three lengths and enters or leaves with one curve; springs
 * are one of two. Not imported by `constants/styles.ts` (Node tests bundle that one). The drag's own timings are `LIFT`.
 */
export const DURATION = { fast: 120, base: 200, slow: 300 } as const;
export const EASING = { enter: Easing.out(Easing.cubic), exit: Easing.in(Easing.cubic) } as const;
export const SPRING = { soft: { damping: 18, stiffness: 180 }, snappy: { damping: 15, stiffness: 220 } } as const;
/** Periods of animations that loop: they are rhythms, not transitions. */
export const LOOP = { blink: 700, ping: 1600, pulse: 950, listening: 800, wiggle: 75, breathe: 1600 } as const;
