import { normalizeLink } from "@/libs/links";
import { deriveNoteTitle, getTextSize } from "@/utils/string";

/*
 * What a share to the app becomes (spec D.3): pure, the hook reads the payloads and makes the note. Only text, an address
 * and pictures are kept; an address is never fetched.
 */

export interface SharedPayload {
  value: string;
  shareType: string;
  mimeType?: string;
}

export interface SharedNote {
  /** The text part, as the note's HTML. */
  html: string;
  title: string;
  /** Image addresses, in the order they came. */
  images: string[];
}

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One `<div>` per line, blank lines at the start and the end dropped; an empty line inside is `<div><br></div>`. */
const textLines = (text: string): string[] => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
};

const lineHtml = (line: string) => (line.trim() ? `<div>${escapeText(line)}</div>` : "<div><br></div>");

/** What a share becomes, or null when it holds nothing the app keeps (text, an address, images). */
export function noteFromShare(payloads: readonly SharedPayload[]): SharedNote | null {
  const html: string[] = [];
  const images: string[] = [];
  let firstLine = "";

  for (const { value, shareType } of payloads) {
    if (shareType === "image") {
      if (value) images.push(value);
    } else if (shareType === "text") {
      const lines = textLines(value ?? "");
      if (!lines.length) continue;
      firstLine ||= lines[0];
      html.push(...lines.map(lineHtml));
    } else if (shareType === "url") {
      const address = (value ?? "").trim();
      if (!address) continue;
      firstLine ||= address;
      const href = normalizeLink(address);
      html.push(
        href ? `<div><a href="${escapeText(href).replace(/"/g, "&quot;")}">${escapeText(address)}</a></div>` : lineHtml(address)
      );
    }
  }

  if (!html.length && !images.length) return null;
  return { html: html.join(""), title: firstLine ? deriveNoteTitle(firstLine) : "", images };
}

/**
 * A share's text kept within the note's size limit (spec D.3: what doesn't fit is left out, with the usual message): cut
 * at the end of the last line that fits. `limit` null: no limit.
 */
export function fitShare(html: string, limit: number | null): { html: string; cut: boolean } {
  if (limit === null || getTextSize(html) <= limit) return { html, cut: false };
  let kept = "";
  let size = 0;
  for (const line of html.split(/(?<=<\/div>)/)) {
    const next = getTextSize(line);
    if (size + next > limit) break;
    kept += line;
    size += next;
  }
  return { html: kept, cut: true };
}
