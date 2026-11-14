import { noteBlockCss, PRINT_BLOCK_COLORS } from "@/libs/noteHtml";

/** The print-only copy of a note, in the top document (`@/libs/print`). */
export const PRINT_ID = "fm-print";

/** The app's font, then the system's. */
const FONT = `"Geist-Regular", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const FONT_SEMIBOLD = `"Geist-SemiBold", ${FONT}`;
const FONT_BOLD = `"Geist-Bold", ${FONT}`;

/**
 * The style sheet of the print-only copy (spec C.5): on screen it isn't shown; in print it is all that is. A white page,
 * dark text in the app's font, A4 margins; pictures never wider than the page nor cut by a page break; headings kept with
 * what follows; code blocks wrapped on a light fill; the kinds of line of 4.1.0 in print colours (as the phone's PDF).
 * A link keeps its text and shows no address after it.
 */
export function printCss(): string {
  return `
#${PRINT_ID} { display: none; }
@media print {
  @page { margin: 18mm 16mm; }
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  body > *:not(#${PRINT_ID}) { display: none !important; }
  #${PRINT_ID} {
    display: block; color: #111; background: #fff; font-family: ${FONT}; font-size: 12pt; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  #${PRINT_ID} h1.note-title { font-family: ${FONT_BOLD}; font-weight: normal; font-size: 20pt; line-height: 1.25; margin: 0 0 14pt; }
  #${PRINT_ID} h1, #${PRINT_ID} h2, #${PRINT_ID} h3 { font-family: ${FONT_SEMIBOLD}; font-weight: normal; break-after: avoid; }
  #${PRINT_ID} b, #${PRINT_ID} strong { font-family: ${FONT_BOLD}; font-weight: normal; }
  #${PRINT_ID} img { display: block; max-width: 100%; max-height: 240mm; height: auto; object-fit: contain; break-inside: avoid; }
  #${PRINT_ID} pre {
    white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f2f2; border-radius: 4pt; padding: 8pt 10pt;
    font-size: 10pt; line-height: 1.45;
  }
  #${PRINT_ID} code, #${PRINT_ID} pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  #${PRINT_ID} li, #${PRINT_ID} blockquote { break-inside: avoid; }
  ${noteBlockCss(PRINT_BLOCK_COLORS)}
}
`;
}
