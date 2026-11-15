import { PHOTO_QUALITY, resizeFor } from "@/utils/imageSize";

/**
 * The web and desktop reducer (`reducePhoto.ts` for the phone): the same size and JPEG quality, drawn on a white canvas
 * first. expo-image-manipulator's web canvas has no background, so a picture with transparency (a window's screenshot,
 * a logo pasted or dropped) came out black where it was clear. Returns the JPEG's base64 (no `data:` prefix).
 */
export async function reducePhoto(uri: string, width?: number, height?: number): Promise<string> {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const w = image.naturalWidth || width || 0;
  const h = image.naturalHeight || height || 0;
  if (!w || !h) return "";
  const resize = resizeFor(w, h);
  const scale = !resize ? 1 : "width" in resize ? resize.width / w : resize.height / h;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY).split(",")[1] ?? "";
}
