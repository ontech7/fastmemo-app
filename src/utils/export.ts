import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { parseImageDataUrl } from "@/utils/dataUrl";
import { wrapHtmlForPdf } from "@/utils/html";

export { htmlToMarkdown, wrapHtmlForPdf } from "@/utils/html";

export async function exportAsPdf(title: string, htmlContent: string): Promise<{ uri: string } | null> {
  const fullHtml = wrapHtmlForPdf(title, htmlContent);
  const result = await Print.printToFileAsync({ html: fullHtml });
  return { uri: result.uri };
}

const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function shareFile(uri: string, filename: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return;

  // Chat apps (Telegram, WhatsApp) interpret a "text/plain" (or "text/markdown")
  // share as plain-text content to send as a message, not as a file attachment —
  // since we only pass a file stream they reject it ("format not supported"). A
  // generic document MIME forces attachment handling; the extension is preserved
  // in the filename so the receiver still sees it as a .txt/.md. An image goes as one, for the gallery and the chats.
  const extension = filename.split(".").pop() ?? "";
  const mimeType = extension === "pdf" ? "application/pdf" : (IMAGE_TYPES[extension] ?? "application/octet-stream");

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: filename,
  });
}

export async function exportAsTextFile(content: string, filename: string): Promise<void> {
  const fileUri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareFile(fileUri, filename);
}

/** Shares an image of a note (a data: URL) as a file: to another app, or to the phone's files and gallery. */
export async function exportImage(dataUrl: string): Promise<void> {
  const image = parseImageDataUrl(dataUrl);
  if (!image) throw new Error("not an image's data URL");
  const filename = `fastmemo-${Date.now()}.${image.extension}`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, image.base64, { encoding: FileSystem.EncodingType.Base64 });
  await shareFile(uri, filename);
}
