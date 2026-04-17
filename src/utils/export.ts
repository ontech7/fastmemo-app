import { stripHtml } from "@/libs/ai";
import { isTauri } from "@/utils/platform";
import { Platform } from "react-native";

export function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Bold + italic combo
  md = md.replace(/<(b|strong)[^>]*><(i|em)[^>]*>(.*?)<\/(i|em)><\/(b|strong)>/gi, "***$3***");
  md = md.replace(/<(i|em)[^>]*><(b|strong)[^>]*>(.*?)<\/(b|strong)><\/(i|em)>/gi, "***$3***");

  // Bold
  md = md.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, "**$2**");

  // Italic
  md = md.replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, "*$2*");

  // Underline (no standard markdown, use HTML)
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, "<u>$1</u>");

  // Strikethrough
  md = md.replace(/<(s|strike|del)[^>]*>(.*?)<\/(s|strike|del)>/gi, "~~$2~~");

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Inline code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    const lines = stripHtml(content)
      .split("\n")
      .map((line) => `> ${line.trim()}`)
      .join("\n");
    return lines + "\n\n";
  });

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, "\n---\n\n");

  // Unordered lists
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, content) => {
    return (
      content.replace(/<li[^>]*>(.*?)<\/li>/gis, (__, item) => {
        return `- ${stripHtml(item).trim()}\n`;
      }) + "\n"
    );
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, content) => {
    let index = 0;
    return (
      content.replace(/<li[^>]*>(.*?)<\/li>/gis, (__, item) => {
        index++;
        return `${index}. ${stripHtml(item).trim()}\n`;
      }) + "\n"
    );
  });

  // Subscript / Superscript (no standard markdown)
  md = md.replace(/<sub[^>]*>(.*?)<\/sub>/gi, "<sub>$1</sub>");
  md = md.replace(/<sup[^>]*>(.*?)<\/sup>/gi, "<sup>$1</sup>");

  // Paragraphs and divs
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<p[^>]*>/gi, "");
  md = md.replace(/<\/div>/gi, "\n");
  md = md.replace(/<div[^>]*>/gi, "");

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

/**
 * Create an HTML document wrapper for PDF export.
 */
export function wrapHtmlForPdf(title: string, htmlContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || "Note"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
      line-height: 1.6;
    }
    h1.note-title {
      font-size: 28px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h1 { font-size: 24px; }
    h2 { font-size: 20px; }
    h3 { font-size: 18px; }
    blockquote {
      border-left: 4px solid #ddd;
      padding: 8px 16px;
      margin: 16px 0;
      color: #555;
      background: #f9f9f9;
    }
    pre {
      background: #f4f4f4;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 24px 0;
    }
    img {
      max-width: 100%;
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table td, table th {
      border: 1px solid #ddd;
      padding: 8px;
    }
  </style>
</head>
<body>
  ${title ? `<h1 class="note-title">${title}</h1>` : ""}
  ${htmlContent}
</body>
</html>`;
}

/**
 * Save content to a file on web.
 * - Tauri: uses native Save dialog via @tauri-apps/api
 * - Browser: uses <a download> fallback
 */
async function saveFileWeb(
  content: string | Blob,
  defaultFilename: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/api/dialog");
    const { writeTextFile, writeBinaryFile } = await import("@tauri-apps/api/fs");

    const filePath = await save({
      defaultPath: defaultFilename,
      filters: filters || [{ name: "All Files", extensions: ["*"] }],
    });
    if (!filePath) return; // user cancelled

    if (typeof content === "string") {
      await writeTextFile(filePath, content);
    } else {
      const buffer = await content.arrayBuffer();
      await writeBinaryFile(filePath, new Uint8Array(buffer));
    }
    return;
  }

  // Browser fallback: <a download>
  const blob = typeof content === "string" ? new Blob([content], { type: "text/plain;charset=utf-8" }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function exportAsPdf(title: string, htmlContent: string): Promise<{ uri: string } | null> {
  const fullHtml = wrapHtmlForPdf(title, htmlContent);

  if (Platform.OS === "web") {
    // Generate a real PDF using jspdf + html2canvas
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");

    // Render the HTML in a temporary off-screen container
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:40px;";
    container.innerHTML = fullHtml.replace(/.*<body[^>]*>/is, "").replace(/<\/body>.*/is, "");
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    document.body.removeChild(container);

    const imgWidth = 190; // A4 width minus margins (mm)
    const pageHeight = 277; // A4 height minus margins (mm)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF("p", "mm", "a4");

    let heightLeft = imgHeight;
    let position = 10; // top margin

    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    if (isTauri()) {
      const { save } = await import("@tauri-apps/api/dialog");
      const { writeBinaryFile } = await import("@tauri-apps/api/fs");

      const defaultName = `${(title || "note").replace(/[^a-zA-Z0-9-_ ]/g, "").substring(0, 50)}.pdf`;
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!filePath) return null;

      const pdfBytes = pdf.output("arraybuffer");
      await writeBinaryFile(filePath, new Uint8Array(pdfBytes));
    } else {
      pdf.save(`${(title || "note").replace(/[^a-zA-Z0-9-_ ]/g, "")}.pdf`);
    }
    return null;
  }

  // On native, use expo-print
  const Print = await import("expo-print");
  const result = await Print.printToFileAsync({ html: fullHtml });
  return { uri: result.uri };
}

export async function shareFile(uri: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    // Web exports are handled by saveFileWeb; this is unused on web
    return;
  }

  const Sharing = await import("expo-sharing");
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".md") ? "text/markdown" : "text/plain",
      dialogTitle: filename,
    });
  }
}

export async function exportAsTextFile(content: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const ext = filename.split(".").pop() || "txt";
    const filters = [{ name: ext === "md" ? "Markdown" : "Text", extensions: [ext] }];
    await saveFileWeb(content, filename, filters);
    return;
  }

  const FileSystem = await import("expo-file-system");
  const fileUri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareFile(fileUri, filename);
}
