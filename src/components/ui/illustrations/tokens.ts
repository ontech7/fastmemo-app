import { StyleSheet } from "react-native";

import { COLOR } from "@/constants/styles";

/*
 * The shared values of the empty-state and crash drawings (spec appendix A): every drawing is a 176 x 112 box of cards
 * in the "ghost cards" style.
 */

export const ILLUSTRATION = { width: 176, height: 112 } as const;

/** A card that isn't there: faint fill, dashed edge. */
export const GHOST = {
  fill: "rgba(255,255,255,0.025)",
  stroke: "rgba(255,255,255,0.22)",
  strokeWidth: 1.5,
  strokeDasharray: "5 4",
} as const;

/** The card the drawing is about, lit in the accent. */
export const LIT = { fill: "rgba(79,107,255,0.10)", stroke: "rgba(107,134,255,0.6)", strokeWidth: 1.5 } as const;

/** The square where a card's icon sits. */
export const TILE = "rgba(107,134,255,0.32)";

/** A line of text on a card: 5 high, rounded. */
export const LINE = { fill: "rgba(255,255,255,0.28)", height: 5, rx: 2.5 } as const;

/** A stroke drawn in the accent (the magnifier). */
export const ACCENT_STROKE = {
  fill: "none",
  stroke: "#6B86FF",
  strokeWidth: 2.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** What covers the cards behind a shape drawn over them: the screen's background. */
export const BACKDROP = COLOR.bg;

/** The box every drawing sits in. */
export const illustrationStyles = StyleSheet.create({
  box: {
    width: ILLUSTRATION.width,
    height: ILLUSTRATION.height,
  },
});
