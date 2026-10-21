import DOMPurify from "dompurify";
import type { DOMPurify as DOMPurifyInstance } from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { addNoteHooks, NOTE_HTML_CONFIG } from "@/editor/sanitizeConfig";
import { withNativeDialog } from "@/libs/desktopCommands";
import { isTauri } from "@/utils/platform";

export { htmlToMarkdown, wrapHtmlForPdf } from "@/utils/html";

/**
 * Save content to a file on web.
 * - Tauri: uses the native Save dialog (dialog + fs plugins)
 * - Browser: uses <a download> fallback
 */
async function saveFileWeb(
  content: string | Blob,
  defaultFilename: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile, writeFile } = await import("@tauri-apps/plugin-fs");

    const filePath = await withNativeDialog(() =>
      save({
        defaultPath: defaultFilename,
        filters: filters || [{ name: "All Files", extensions: ["*"] }],
      })
    );
    if (!filePath) return; // user cancelled

    if (typeof content === "string") {
      await writeTextFile(filePath, content);
    } else {
      const buffer = await content.arrayBuffer();
      await writeFile(filePath, new Uint8Array(buffer));
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

let purifier: DOMPurifyInstance | null = null;
function notePurifier(): DOMPurifyInstance {
  if (!purifier) {
    purifier = DOMPurify(window);
    addNoteHooks(purifier);
  }
  return purifier;
}

export async function exportAsPdf(title: string, htmlContent: string): Promise<{ uri: string } | null> {
  // Render the note in a temporary off-screen container: the body of `wrapHtmlForPdf`, built as nodes. It is the app's
  // own page: whatever ran in the note's HTML would run as the app (LL-060), so it comes as DOMPurify's nodes, never
  // parsed again.
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:40px;";
  if (title) {
    const heading = document.createElement("h1");
    heading.className = "note-title";
    heading.textContent = title;
    container.appendChild(heading);
  }
  container.appendChild(notePurifier().sanitize(htmlContent, { ...NOTE_HTML_CONFIG, RETURN_DOM_FRAGMENT: true }));
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
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");

    const defaultName = `${(title || "note").replace(/[^a-zA-Z0-9-_ ]/g, "").substring(0, 50)}.pdf`;
    const filePath = await withNativeDialog(() =>
      save({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      })
    );
    if (!filePath) return null;

    const pdfBytes = pdf.output("arraybuffer");
    await writeFile(filePath, new Uint8Array(pdfBytes));
  } else {
    pdf.save(`${(title || "note").replace(/[^a-zA-Z0-9-_ ]/g, "")}.pdf`);
  }
  return null;
}

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
