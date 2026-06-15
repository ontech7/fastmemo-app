import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { wrapHtmlForPdf } from "@/utils/html";

export { htmlToMarkdown, wrapHtmlForPdf } from "@/utils/html";

export async function exportAsPdf(title: string, htmlContent: string): Promise<{ uri: string } | null> {
  const fullHtml = wrapHtmlForPdf(title, htmlContent);
  const result = await Print.printToFileAsync({ html: fullHtml });
  return { uri: result.uri };
}

export async function shareFile(uri: string, filename: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return;

  // Chat apps (Telegram, WhatsApp) interpret a "text/plain" (or "text/markdown")
  // share as plain-text content to send as a message, not as a file attachment —
  // since we only pass a file stream they reject it ("format not supported"). A
  // generic document MIME forces attachment handling; the extension is preserved
  // in the filename so the receiver still sees it as a .txt/.md.
  const mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";

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
