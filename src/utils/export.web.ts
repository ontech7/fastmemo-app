import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { isTauri } from "@/utils/platform";
import { wrapHtmlForPdf } from "@/utils/html";

export { htmlToMarkdown, wrapHtmlForPdf } from "@/utils/html";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function shareFile(_uri: string, _filename: string): Promise<void> {
  // Web exports are handled by saveFileWeb via exportAsTextFile / exportAsPdf;
  // this is a no-op on web to keep the public API parity with the native
  // variant.
}

export async function exportAsTextFile(content: string, filename: string): Promise<void> {
  const ext = filename.split(".").pop() || "txt";
  const filters = [{ name: ext === "md" ? "Markdown" : "Text", extensions: [ext] }];
  await saveFileWeb(content, filename, filters);
}
