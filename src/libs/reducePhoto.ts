import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";

import { PHOTO_QUALITY, resizeFor } from "@/utils/imageSize";

/** A picture's size in pixels, or null when it can't be read. The callback form: react-native-web has no promise. */
const sizeOf = (uri: string) =>
  new Promise<{ width: number; height: number } | null>((resolve) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    )
  );

/**
 * A picture as it goes into a note or a report: its long side brought to `PHOTO_LONG_SIDE` when larger, saved as JPEG at
 * `PHOTO_QUALITY`. Returns the JPEG's base64 (no `data:` prefix). `width` / `height` are the picker's, when it knows them;
 * without them (a picture pasted or dropped) the picture's own are read first.
 */
export async function reducePhoto(uri: string, width?: number, height?: number): Promise<string> {
  const size = width && height ? { width, height } : await sizeOf(uri);
  const context = ImageManipulator.manipulate(uri);
  const resize = resizeFor(size?.width, size?.height);
  if (resize) context.resize(resize);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY, base64: true });
  return saved.base64 ?? "";
}
