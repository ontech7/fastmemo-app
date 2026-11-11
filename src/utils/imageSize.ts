/** How a picture is reduced before it goes into a note or a report: its long side at most this many pixels. */
export const PHOTO_LONG_SIDE = 1600;
/** The JPEG quality it is saved at. */
export const PHOTO_QUALITY = 0.6;

/** The resize that brings the long side to `longSide`, or null when the picture is already within it (or has no size). */
export function resizeFor(
  width: number | undefined,
  height: number | undefined,
  longSide: number = PHOTO_LONG_SIDE
): { width: number } | { height: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= longSide) return null;
  return width >= height ? { width: longSide } : { height: longSide };
}
