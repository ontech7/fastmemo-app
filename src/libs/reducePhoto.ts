import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { PHOTO_QUALITY, resizeFor } from "@/utils/imageSize";

/**
 * A picture as it goes into a note or a report: its long side brought to `PHOTO_LONG_SIDE` when larger, saved as JPEG at
 * `PHOTO_QUALITY`. Returns the JPEG's base64 (no `data:` prefix). `width` / `height` are the picker's, when it knows them.
 */
export async function reducePhoto(uri: string, width?: number, height?: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const resize = resizeFor(width, height);
  if (resize) context.resize(resize);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY, base64: true });
  return saved.base64 ?? "";
}
