/** The desktop window's zoom, in percent (spec C.4): Ctrl/Cmd + and - step through these. */
export const ZOOM_STEPS = [80, 90, 100, 110, 125, 150, 175, 200] as const;

/**
 * The next step up or down from `current`; a value between two steps goes to the nearer one in that direction. A
 * `current` that isn't a number from 80 to 200 counts as 100.
 */
export function nextZoom(current: number, direction: "in" | "out"): number {
  const from = Number.isFinite(current) && current >= ZOOM_STEPS[0] && current <= ZOOM_STEPS.at(-1)! ? current : 100;
  if (direction === "in") return ZOOM_STEPS.find((step) => step > from) ?? ZOOM_STEPS.at(-1)!;
  return [...ZOOM_STEPS].reverse().find((step) => step < from) ?? ZOOM_STEPS[0];
}

/**
 * The zoom a key asks for, with Cmd (Mac) / Ctrl held as `mod`: + (also = and the numpad's plus) in, - (also the numpad's
 * minus) out, 0 back to 100. Shift types + on many layouts; Shift+0, which WebKit reports as 0 (= on an Italian Mac), is
 * none of them.
 */
export function zoomKeyOf(
  e: Pick<KeyboardEvent, "key" | "code" | "shiftKey" | "altKey">,
  mod: boolean
): "in" | "out" | "reset" | null {
  if (!mod || e.altKey) return null;
  if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") return "in";
  if (e.key === "-" || e.code === "NumpadSubtract") return "out";
  if ((e.key === "0" && !e.shiftKey) || e.code === "Numpad0") return "reset";
  return null;
}
