/*
 * A text note's HTML as the AI works on it (ADR-004, long notes): its lines (paragraphs, headings, list
 * items, and the lines a `<br>` or an image separates inside one), each rewritten on its own and put back where it was, so
 * the note keeps its structure. What isn't text (images, code, tables, rules) is never touched, and a line the AI leaves as
 * it was keeps its formatting. Pure, no DOM (React Native has none).
 */

/** A piece of the note: kept as it is, or a unit of text the AI may rewrite (`inner` is replaced, `open`/`close` stay). */
export type NoteSegment =
  | { kind: "keep"; html: string }
  | { kind: "unit"; tag: string; open: string; inner: string; close: string; text: string };

/** A tag, its name in group 1 (attribute values may hold a `>`). */
const TAG_RE = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const BLOCK = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "center",
  "details",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

/** Blocks kept whole: code, tables, figures, rules and forms are not prose. */
const OPAQUE = new Set(["details", "dl", "fieldset", "figure", "form", "hr", "pre", "table"]);

/** Content a rewrite would lose (the text is put back without markup): a unit holding any of it is kept. */
const EMBEDDED = /<(img|video|audio|iframe|svg|canvas|object|embed|input|picture)\b/i;

/** What ends a line inside a block: a line break, or an image or a checkbox between two runs of text (kept apart). */
const LINE_CUT = new Set(["br", "embed", "img", "input"]);

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** The text a fragment shows: line breaks for `<br>`, no tags, entities decoded. */
export function textOfHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      const lower = name.toLowerCase();
      if (lower in ENTITIES) return ENTITIES[lower];
      const code = lower.startsWith("#x")
        ? parseInt(lower.slice(2), 16)
        : lower.startsWith("#")
          ? parseInt(lower.slice(1), 10)
          : NaN;
      // a code point past Unicode's (pasted markup) stays as it was written
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Text as inline HTML: escaped, its line breaks as `<br>`. */
export function textToInlineHtml(text: string): string {
  return escapeHtml(text.trim()).replace(/\r?\n/g, "<br>");
}

const keep = (html: string): NoteSegment => ({ kind: "keep", html });

/** Where the element opened just before `from` closes (its close tag's start and end), or null if it never does. */
function findClose(html: string, name: string, from: number): { start: number; end: number } | null {
  const re = new RegExp(TAG_RE.source, "g");
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const tagName = m[1]?.toLowerCase();
    if (!tagName || VOID.has(tagName) || m[0].endsWith("/>")) continue;
    if (m[0][1] === "/") {
      depth--;
      if (depth === 0) return tagName === name ? { start: m.index, end: re.lastIndex } : null;
    } else {
      depth++;
    }
  }
  return null;
}

function hasBlock(html: string): boolean {
  const re = new RegExp(TAG_RE.source, "g");
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] && BLOCK.has(m[1].toLowerCase())) return true;
  }
  return false;
}

/**
 * A block's inline content, one unit per line: a `<br>` or an image outside any inline element ends a line (dictation and
 * pasted text join their lines with `<br>`; an image sits between two runs of text). The block's open tag goes with its
 * first line, the close tag with its last.
 */
function pushUnit(tag: string, open: string, inner: string, close: string, out: NoteSegment[]) {
  const re = new RegExp(TAG_RE.source, "g");
  const lines: string[] = [];
  const cuts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let m = re.exec(inner); m; m = re.exec(inner)) {
    const name = m[1]?.toLowerCase();
    if (!name) continue;
    if (m[0][1] === "/") depth = Math.max(0, depth - 1);
    else if (!VOID.has(name) && !m[0].endsWith("/>")) depth++;
    else if (depth === 0 && LINE_CUT.has(name)) {
      lines.push(inner.slice(start, m.index));
      cuts.push(m[0]);
      start = re.lastIndex;
    }
  }
  lines.push(inner.slice(start));
  lines.forEach((line, i) => {
    const before = i === 0 ? open : "";
    const after = i === lines.length - 1 ? close : cuts[i];
    const text = textOfHtml(line);
    if (!text.trim() || EMBEDDED.test(line)) {
      out.push(keep(before + line + after));
    } else {
      out.push({ kind: "unit", tag, open: before, inner: line, close: i === lines.length - 1 ? close : "", text });
      if (i < lines.length - 1) out.push(keep(cuts[i]));
    }
  });
}

function pushBlock(name: string, open: string, inner: string, close: string, out: NoteSegment[]) {
  if (OPAQUE.has(name)) {
    out.push(keep(open + inner + close));
  } else if (name === "ul" || name === "ol" || hasBlock(inner)) {
    // a list, or a block holding blocks: its own text and its children are the units
    out.push(keep(open));
    splitInto(inner, out);
    out.push(keep(close));
  } else {
    pushUnit(name, open, inner, close, out);
  }
}

function splitInto(html: string, out: NoteSegment[]) {
  const re = new RegExp(TAG_RE.source, "g");
  // Text and inline markup between blocks: a unit with no tag of its own (the first line pell leaves unwrapped).
  let runStart = 0;
  const flushRun = (end: number) => {
    if (end > runStart) pushUnit("", "", html.slice(runStart, end), "", out);
  };
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const name = m[1]?.toLowerCase();
    if (!name || !BLOCK.has(name)) continue;
    flushRun(m.index);
    if (m[0][1] === "/" || VOID.has(name) || m[0].endsWith("/>")) {
      // a rule, or a stray close tag: kept where it is
      out.push(keep(m[0]));
      runStart = re.lastIndex;
      continue;
    }
    const close = findClose(html, name, re.lastIndex);
    if (!close) {
      // not well formed from here: nothing past this point is rewritten
      out.push(keep(html.slice(m.index)));
      runStart = html.length;
      break;
    }
    pushBlock(name, m[0], html.slice(re.lastIndex, close.start), html.slice(close.start, close.end), out);
    runStart = close.end;
    re.lastIndex = close.end;
  }
  flushRun(html.length);
}

/** The note's HTML as kept pieces and rewritable units, in order: joining every piece's HTML gives the note back. */
export function splitNoteBlocks(html: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  splitInto(html ?? "", out);
  // neighbouring kept pieces as one
  return out.reduce<NoteSegment[]>((merged, segment) => {
    const last = merged[merged.length - 1];
    if (segment.kind === "keep" && last?.kind === "keep") last.html += segment.html;
    else merged.push(segment.kind === "keep" ? { ...segment } : segment);
    return merged;
  }, []);
}

/** Whether two texts read the same (spacing aside). */
export const sameText = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * The note with each unit at index `i` of `rewrites` replaced by its new text. A unit left out, or given back unchanged,
 * keeps its HTML (bold, links, alignment): only a unit the AI changed loses its inline formatting.
 */
export function joinNoteBlocks(segments: NoteSegment[], rewrites: Map<number, string> = new Map()): string {
  return segments
    .map((segment, i) => {
      if (segment.kind === "keep") return segment.html;
      const next = rewrites.get(i);
      if (next === undefined || !next.trim() || sameText(next, segment.text))
        return segment.open + segment.inner + segment.close;
      return segment.open + textToInlineHtml(next) + segment.close;
    })
    .join("");
}

/** The units' text, one per line (what a summary reads). */
export function blocksText(segments: NoteSegment[]): string {
  return segments
    .filter((segment) => segment.kind === "unit")
    .map((segment) => (segment as { text: string }).text.trim())
    .join("\n");
}

/**
 * A summary the AI added: its label is marked (a bold line the user wrote is never taken for one), and only one at the very
 * top of the note counts. Whoever edits its text keeps the mark; whoever unbolds the label makes it part of the note.
 */
const SUMMARY_LABEL = /^<div><b data-fm="summary">[^<]*<\/b><\/div>/;

/** Where a summary the AI added at the top of the note ends (its label, its text and the empty line after it), or 0. */
function summaryEnd(html: string): number {
  const label = SUMMARY_LABEL.exec(html);
  if (!label) return 0;
  const re = new RegExp(TAG_RE.source, "g");
  re.lastIndex = label[0].length;
  const open = re.exec(html);
  if (open?.index !== label[0].length || open[1]?.toLowerCase() !== "div" || open[0][1] === "/") return 0;
  const close = findClose(html, "div", re.lastIndex);
  // Enter at the end of the label copies its mark onto the user's next line: on doubt, nothing is taken for the summary
  if (!close || html.slice(re.lastIndex, close.start).includes("data-fm")) return 0;
  const gap = /^<div><br\s*\/?><\/div>/i.exec(html.slice(close.end));
  return close.end + (gap ? gap[0].length : 0);
}

/** The label of a summary the AI added: a rewrite leaves it alone (rewritten, it would lose its mark). */
export const isSummaryLabel = (segment: NoteSegment) =>
  segment.kind === "unit" && /^<b data-fm="summary">[^<]*<\/b>$/.test(segment.inner);

/** Whether the note starts with a summary the AI added (a new one replaces it). */
export const hasSummary = (html: string) => summaryEnd(html ?? "") > 0;

/** The note without a summary the AI added at its top (what a new summary reads, and what it goes on top of). */
export function withoutSummary(html: string): string {
  return (html ?? "").slice(summaryEnd(html ?? ""));
}

/** The note with `summary` on top, under a bold `label` (replacing one added before), and the note as it was below. */
export function withSummary(html: string, label: string, summary: string): string {
  const top = `<div><b data-fm="summary">${escapeHtml(label.trim())}</b></div><div>${textToInlineHtml(summary)}</div>`;
  return `${top}<div><br></div>${withoutSummary(html)}`;
}

/**
 * About how many tokens the model reads for `text`, without loading it: Qwen's tokenizer takes about one token per CJK
 * character and about 3.5 characters per token elsewhere. Good enough for chunking and for a time estimate.
 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯豈-﫿]/g) ?? []).length;
  return Math.ceil(cjk + (text.length - cjk) / 3.5);
}

/**
 * Whether a sentence ends at `text[i]`: a full stop, "!" or "?" before a space or the end ("2.300", "e.g." and a URL's dots
 * don't end one), a CJK one, or a line break.
 */
function endsSentence(text: string, i: number): boolean {
  if (/[。！？\n]/.test(text[i])) return true;
  const next = text[i + 1];
  return /[.!?]/.test(text[i]) && (next === undefined || /\s/.test(next));
}

/**
 * What's left of an answer cut off mid-way: up to its last complete sentence, or its last complete line (a list); empty if
 * none ended.
 */
export function completeSentences(text: string): string {
  for (let i = text.length - 1; i >= 0; i--) {
    if (endsSentence(text, i)) return text.slice(0, i + 1).trim();
  }
  return "";
}

/**
 * `text` in consecutive pieces of about `budget` tokens at most, cut after a sentence (or, in a sentence longer than that,
 * after a space). Joining the pieces gives `text` back.
 */
export function splitText(text: string, budget: number): string[] {
  if (estimateTokens(text) <= budget) return [text];
  // sentences, each with the spaces after it
  const sentences: string[] = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    // (a run of marks ends at its last one)
    if (!endsSentence(text, i) || /[。！？\n]/.test(text[i + 1] ?? "")) continue;
    let end = i + 1;
    while (end < text.length && /\s/.test(text[end])) end++;
    sentences.push(text.slice(from, end));
    from = end;
    i = end - 1;
  }
  if (from < text.length) sentences.push(text.slice(from));

  const pieces: string[] = [];
  let current = "";
  const add = (part: string) => {
    if (current && estimateTokens(current + part) > budget) {
      pieces.push(current);
      current = "";
    }
    current += part;
  };
  for (const sentence of sentences) {
    if (estimateTokens(sentence) <= budget) {
      add(sentence);
      continue;
    }
    // a sentence longer than a piece: cut after a space (or anywhere, in a script without spaces)
    const size = Math.max(1, Math.floor((sentence.length * budget) / estimateTokens(sentence)));
    for (let at = 0; at < sentence.length; ) {
      let end = Math.min(sentence.length, at + size);
      const space = sentence.lastIndexOf(" ", end - 1);
      if (end < sentence.length && space > at + size * 0.6) end = space + 1;
      // never between the two halves of an emoji
      if (end < sentence.length && /[\udc00-\udfff]/.test(sentence[end])) end = end > at + 1 ? end - 1 : end + 1;
      add(sentence.slice(at, end));
      at = end;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Consecutive texts grouped into chunks of at most about `budget` tokens (a longer text is split first). */
export function chunkTexts(texts: string[], budget: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts.flatMap((t) => splitText(t, budget).map((piece) => piece.trim()))) {
    const size = estimateTokens(text);
    if (current.length && tokens + size > budget) {
      chunks.push(current.join("\n"));
      current = [];
      tokens = 0;
    }
    current.push(text);
    tokens += size;
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks;
}
