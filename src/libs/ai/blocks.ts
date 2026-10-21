/*
 * A text note's HTML as the AI works on it (spec docs/AI_QWEN35_UPGRADE.md §7.5): its paragraphs, headings and list items,
 * each rewritten on its own and put back where it was, so the note keeps its structure. What isn't text (images, code,
 * tables, rules) is never touched, and a unit the AI leaves as it was keeps its formatting. Pure, no DOM (React Native has
 * none).
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

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** The text a fragment shows: line breaks for `<br>`, no tags, entities decoded. */
export function textOfHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      const lower = name.toLowerCase();
      if (lower in ENTITIES) return ENTITIES[lower];
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return entity;
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

function pushUnit(tag: string, open: string, inner: string, close: string, out: NoteSegment[]) {
  const text = textOfHtml(inner);
  if (!text.trim() || EMBEDDED.test(inner)) out.push(keep(open + inner + close));
  else out.push({ kind: "unit", tag, open, inner, close, text });
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

const BOLD_LABEL = /^\s*<(b|strong)>([^<]*)<\/\1>\s*$/i;

/**
 * Where a summary the AI added before sits: a bold label (in any of `labels`) on the note's first line, the summary on the
 * next, and the empty line after it. Null if the note doesn't start with one.
 */
function summaryAtTop(segments: NoteSegment[], labels: string[]): { from: number; to: number } | null {
  const first = segments.findIndex((s) => s.kind === "unit" || s.html.replace(/<[^>]*>|\s|&nbsp;/g, ""));
  const label = segments[first];
  if (label?.kind !== "unit" || !labels.some((name) => name.trim() === BOLD_LABEL.exec(label.inner)?.[2]?.trim())) return null;
  const summary = segments.findIndex((s, i) => i > first && s.kind === "unit");
  if (summary === -1) return null;
  // only kept markup between them (closing and opening tags), nothing the user wrote
  if (segments.slice(first + 1, summary).some((s) => s.kind === "keep" && textOfHtml(s.html).trim())) return null;
  return { from: first, to: summary };
}

/** The note without a summary the AI added at its top (what a new summary reads, and what it goes on top of). */
export function withoutSummary(segments: NoteSegment[], labels: string[]): NoteSegment[] {
  const found = summaryAtTop(segments, labels);
  if (!found) return segments;
  const rest = segments.slice(found.to + 1);
  // the empty line that separated it from the note
  const next = rest[0];
  if (next?.kind === "keep") {
    // (any closing tags before it stay: they close something the note opened)
    const trimmed = next.html.replace(/^((?:\s*<\/[a-z0-9]+>)*)\s*<div>\s*<br\s*\/?>\s*<\/div>/i, "$1");
    rest[0] = { kind: "keep", html: trimmed };
  }
  return [...segments.slice(0, found.from), ...rest];
}

/** The note with `summary` on top, under a bold `label` (replacing one added before), and the note as it was below. */
export function withSummary(html: string, label: string, summary: string, labels: string[]): string {
  const body = joinNoteBlocks(withoutSummary(splitNoteBlocks(html), [label, ...labels]));
  return `<div><b>${escapeHtml(label.trim())}</b></div><div>${textToInlineHtml(summary)}</div><div><br></div>${body}`;
}

/**
 * About how many tokens the model reads for `text`, without loading it: Qwen's tokenizer takes about one token per CJK
 * character and about 3.5 characters per token elsewhere. Good enough for chunking and for a time estimate.
 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯豈-﫿]/g) ?? []).length;
  return Math.ceil(cjk + (text.length - cjk) / 3.5);
}

/** Consecutive texts grouped into chunks of at most `budget` tokens (a text over it is a chunk on its own). */
export function chunkTexts(texts: string[], budget: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts) {
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
