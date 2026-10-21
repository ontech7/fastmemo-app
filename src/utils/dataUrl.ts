/** An image in a data: URL (how notes keep their images): its MIME type, its data and a file extension for it. */
export interface DataUrlImage {
  mime: string;
  base64: string;
  extension: string;
}

/** The image of a base64 data: URL, or null for anything else (a link, an old version's file). */
export const parseImageDataUrl = (url: string): DataUrlImage | null => {
  const match = /^data:(image\/([\w.+-]+));base64,(.*)$/s.exec(url);
  if (!match) return null;
  const [, mime, subtype, base64] = match;
  return { mime, base64, extension: subtype === "jpeg" ? "jpg" : subtype.replace(/\+.*$/, "") };
};

/** Whether a URL is an image's base64 data: URL, without reading the data. */
export const isImageDataUrl = (url: string) => /^data:image\/[\w.+-]+;base64,/.test(url);
