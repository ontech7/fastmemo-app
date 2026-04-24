import * as FileSystem from "expo-file-system";
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
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".md") ? "text/markdown" : "text/plain",
      dialogTitle: filename,
    });
  }
}

export async function exportAsTextFile(content: string, filename: string): Promise<void> {
  const fileUri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareFile(fileUri, filename);
}
