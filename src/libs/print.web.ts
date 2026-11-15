import { PRINT_ID, printCss } from "@/libs/printCss";
import { appendNoteNodes } from "@/utils/export";
import { isTauri } from "@/utils/platform";

export { printCss } from "@/libs/printCss";

/*
 * Print a text note, and save it as a PDF that is text (spec C.5). The note is laid out in a print-only copy in the top
 * document (`#fm-print`, shown only in print: `printCss`), then the system's print dialog opens on the window; its "Save
 * as PDF" writes the text, which can be selected and searched. A frame is never printed (the Mac prints it blank).
 *
 * The copy is replaced at the next print and removed when the note's editor leaves (`setPrintable(null)`), not when the
 * dialog closes: the engines tell that differently, and a hidden copy costs nothing.
 */

const STYLE_ID = "fm-print-style";

/** Whether "Print or save as PDF" replaces the picture PDF here. */
export const canPrint = true;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = printCss();
  document.head.appendChild(style);
}

/** The page's own title while a note's is lent to the print (the PDF is named after it); null when none is lent. */
let pageTitle: string | null = null;

function giveBackTitle() {
  if (pageTitle === null) return;
  document.title = pageTitle;
  pageTitle = null;
}

function removeCopy() {
  document.getElementById(PRINT_ID)?.remove();
  giveBackTitle();
}

/** Lays the note out in a print-only part of the main page and opens the system's print dialog. */
export async function printNote(title: string, html: string): Promise<void> {
  ensureStyle();
  removeCopy();
  const copy = document.createElement("div");
  copy.id = PRINT_ID;
  appendNoteNodes(copy, title, html);
  document.body.appendChild(copy);
  // The pictures decoded and the fonts loaded, or the dialog's preview misses them.
  await Promise.all([...copy.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
  await document.fonts.ready;
  // The dialog names the PDF after the page: the note's title for it (an untitled note keeps the app's). A browser's
  // print waits for its dialog, and the title comes back after it; the Tauri window's dialog opens on its own, so there
  // it comes back with the copy (the next print, or the editor leaving).
  if (title.trim()) {
    pageTitle = document.title;
    document.title = title.trim();
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("print_window");
  } else {
    try {
      window.print();
    } finally {
      giveBackTitle();
    }
  }
}

let printable: (() => void) | null = null;

/** What Ctrl/Cmd + P prints: set by the text editor on screen, null when it leaves (its printed copy goes with it). */
export function setPrintable(print: (() => void) | null): void {
  printable = print;
  if (!print) removeCopy();
}

/** Runs it. false when nothing on screen can be printed. */
export function printCurrent(): boolean {
  if (!printable) return false;
  printable();
  return true;
}
