import { store } from "@/slicers/store";
import type { Category } from "@/types";

import { REWRITE_LENGTH_RATIO } from "./constants";
import type { EditorAction } from "./types";

/** The category the AI named: the exact name first ("Casa" is not "Casa al mare"), then one containing it. */
export function findCategoryByName(name: string): Category | undefined {
  const state = store.getState();
  const categories = state.categories.items;
  const lowerName = name.toLowerCase();
  return (
    categories.find((c: Category) => c.name === name) ??
    categories.find((c: Category) => c.name.toLowerCase() === lowerName) ??
    categories.find((c: Category) => c.name.toLowerCase().includes(lowerName))
  );
}

/** Strip HTML tags and decode entities to get plain text for AI processing. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|h[1-6]|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The answer without a reasoning block: thinking is turned off for every action, but a model may still open one. A block
 * left open (the token budget ran out inside it) leaves no answer at all.
 */
export function stripThinking(text: string): string {
  const open = text.indexOf("<think>");
  if (open === -1) return text;
  const close = text.indexOf("</think>", open);
  if (close === -1) return text.slice(0, open).trim();
  return (text.slice(0, open) + text.slice(close + "</think>".length)).trim();
}

/** What a stream shows so far: no reasoning block, not even the start of its tag, and no leading blank lines. */
export function visibleStreamText(text: string): string {
  const start = text.trimStart();
  if (start && "<think>".startsWith(start)) return "";
  return stripThinking(text).trimStart();
}

/**
 * Collects streamed tokens and hands the visible text to `onText` at most every `intervalMs` (a render per token would be
 * dozens a second). `stop` drops what is pending: call it when the answer lands, or on cancel.
 */
export function createTextStream(onText: (text: string) => void, intervalMs = 50) {
  let text = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const emit = () => {
    timer = null;
    if (!stopped) onText(visibleStreamText(text));
  };
  return {
    push(token: string) {
      if (stopped) return;
      text += token;
      if (!timer) timer = setTimeout(emit, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Hands `onValue` the latest value at most every `intervalMs` (a render per token would be dozens a second). `stop` drops
 * what is pending.
 */
export function createThrottle<T>(onValue: (value: T) => void, intervalMs = 50) {
  let latest: T;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  return {
    push(value: T) {
      if (stopped) return;
      latest = value;
      if (!timer)
        timer = setTimeout(() => {
          timer = null;
          if (!stopped) onValue(latest);
        }, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** A label the model may put before a title or a summary ("Titolo: ..."), by action. */
const ANSWER_LABELS: Partial<Record<EditorAction, RegExp>> = {
  generate_title: /^(Title|Titolo|Titel|Título|Titulo|Titre|タイトル|标题)\s*[:：]\s*/i,
  summarize: /^(Summary|Riassunto|Zusammenfassung|Resumen|Résumé|Resume|要約|摘要)\s*[:：]\s*/i,
  summarize_part: /^(Summary|Riassunto|Zusammenfassung|Resumen|Résumé|Resume|要約|摘要)\s*[:：]\s*/i,
};

const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["«", "»"],
  ["「", "」"],
  ["**", "**"],
];

const wraps = (text: string, [open, close]: [string, string]) =>
  text.length > open.length + close.length && text.startsWith(open) && text.endsWith(close);

/**
 * The model's answer without what it adds around it: quotes or bold around the whole answer, a "Title:" before a title or
 * a "Summary:" before a summary. Only what the input didn't have: an input quoted as a whole stays quoted (in its new
 * quotes, translated), and quotes that open and close inside the answer (dialogue, two quoted words) are the text's own.
 */
export function cleanAnswer(action: EditorAction, input: string, answer: string): string {
  let text = answer.trim();
  const source = input.trim();
  if (!QUOTE_PAIRS.some((pair) => wraps(source, pair))) {
    for (const pair of QUOTE_PAIRS) {
      const inner = text.slice(pair[0].length, -pair[1].length);
      if (wraps(text, pair) && !inner.includes(pair[0]) && !inner.includes(pair[1])) text = inner.trim();
    }
  }
  // a title or a summary is new text: its label is never the note's
  const label = ANSWER_LABELS[action];
  if (label) text = text.replace(label, "");
  return text.trim();
}

const EDGE_PUNCTUATION = /^[.,;:!?¡¿"'«»“”„()[\]{}…–—-]+|[.,;:!?¡¿"'«»“”„()[\]{}…–—-]+$/g;

/** A text's words, lowercased, without the punctuation around them. */
const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(EDGE_PUNCTUATION, ""))
    .filter(Boolean);

/**
 * Whether a grammar fix kept enough of the words: one that changed most of them rewrote or translated the text instead
 * (the 2B turned a short Italian heading into Spanish, AI evaluation 2026-10). Text without spaces (Chinese, Japanese) and a
 * single word aren't checked.
 */
function keepsWords(input: string, output: string): boolean {
  const before = wordsOf(input);
  if (before.length < 2) return true;
  const after = wordsOf(output);
  // a word fixed by one letter added, dropped, changed or swapped is kept ("mamam" -> "mamma")
  const kept = before.filter((word) => after.some((other) => oneEditApart(word, other)));
  return kept.length / before.length >= 0.4;
}

/** Whether two words are the same, or one letter added, dropped, changed or two swapped apart. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // changed, or swapped with the next
    return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Whether a rewrite is worth showing: not empty, no reasoning tag, and a length in the action's range (a short text gets a
 * few characters of slack: "ok" -> "Ok." is fine).
 */
export function isPlausibleRewrite(action: EditorAction, input: string, output: string): boolean {
  const out = output.trim();
  if (!out || out.includes("<think") || out.includes("</think>")) return false;
  if (action === "fix_grammar" && !keepsWords(input, out)) return false;
  const range = REWRITE_LENGTH_RATIO[action];
  if (!range) return true;
  const inLength = input.trim().length;
  if (Math.abs(out.length - inLength) <= 12) return true;
  const ratio = out.length / Math.max(inLength, 1);
  return ratio >= range[0] && ratio <= range[1];
}

const itemKey = (item: string) => item.trim().toLowerCase();

/** Trimmed, non-empty items, each once, minus any already among `existing` (the model likes to repeat the list). */
export function cleanSuggestedItems(items: string[], existing: string[] = []): string[] {
  const seen = new Set(existing.map(itemKey));
  const out: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text || seen.has(itemKey(text))) continue;
    seen.add(itemKey(text));
    out.push(text);
  }
  return out;
}

/** The strings a JSON array has completed so far: a streamed `["Milk","Bre` gives `["Milk"]`. */
export function completedJsonStrings(partial: string): string[] {
  const out: string[] = [];
  for (const match of partial.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    try {
      out.push(JSON.parse(`"${match[1]}"`));
    } catch {
      // a broken escape: skip it
    }
  }
  return out;
}

/** A GBNF string literal of `text` (quotes, backslashes and line breaks escaped). */
function gbnfLiteral(text: string): string {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/**
 * A grammar whose only sentences are the category names and `none`: the model can't answer with a category that doesn't
 * exist, and no fuzzy matching has to guess which one it meant.
 */
export function categoryGrammar(names: string[]): string {
  const options = [...new Set(names.filter((name) => name.trim()))];
  return `root ::= ${[...options, "none"].map(gbnfLiteral).join(" | ")}`;
}
