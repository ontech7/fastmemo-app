import type { Note } from "@/types";

import { fold } from "./fold";
import type { NoteDoc } from "./lines";
import { tagCounts } from "./tags";
import type { TagCount } from "./tags";

export interface Range {
  start: number;
  end: number;
}

/** The line shown under a result: the first of the note that holds a typed word. */
export interface HitLine {
  text: string;
  ranges: Range[];
  label?: string;
  mono?: boolean;
  tabId?: string;
  /** How many other lines of the note hold a typed word. */
  more: number;
  /** The note's own text at the first match of the line: what the find bar is given. */
  word: string;
}

export interface SearchHit {
  note: Note;
  title: string;
  titleRanges: Range[];
  /** Absent when the note was found by its title alone. */
  line?: HitLine;
}

export interface SearchScope {
  /** null in "All". */
  categoryIcon: string | null;
  showHidden: boolean;
}

export interface SearchResult {
  terms: string[];
  /** In "All", every hit; in a category, the hits in it. */
  here: SearchHit[];
  /** In a category, the hits in the others. */
  elsewhere: SearchHit[];
  /** Filled only when the query is one term starting with "#". */
  tags: TagCount[];
}

/** The most characters of a line shown, besides the "…" at either end. */
export const LINE_MAX = 80;
/** How much of the line is kept before its first match. */
const LEAD = 16;
/** How far back a space is looked for, so the line starts on a word. */
const WORD_BACK = 8;

/** The typed text as terms: composed, folded, split on white space, repeats dropped. */
export function parseQuery(text: string): string[] {
  const terms: string[] = [];
  for (const part of fold(text.normalize("NFC")).split(/\s+/)) {
    if (part && !terms.includes(part)) terms.push(part);
  }
  return terms;
}

/** Every occurrence of every term in `folded`, sorted, those that overlap or touch made one. */
function rangesIn(folded: string, terms: readonly string[]): Range[] {
  const found: Range[] = [];
  for (const term of terms) {
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) {
      found.push({ start: at, end: at + term.length });
    }
  }
  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * A line cut to fit: at most `max` characters of it, from 16 before its first range (moved back to a space within 8
 * characters, to the start when fewer than 16 would be left out, back from the end when it would run past it), with "…"
 * where text was cut. The ranges are shifted to the result, clipped, and dropped outside the window.
 */
export function cutLine(text: string, ranges: Range[], max: number = LINE_MAX): { text: string; ranges: Range[] } {
  if (text.length <= max) return { text, ranges: ranges.map((range) => ({ ...range })) };

  let start = ranges.length ? Math.max(0, ranges[0].start - LEAD) : 0;
  if (start > 0) {
    const space = text.lastIndexOf(" ", start - 1);
    if (space >= 0 && start - space <= WORD_BACK) start = space + 1;
  }
  if (start < LEAD) start = 0;
  if (start + max > text.length) start = text.length - max;
  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start++;
  let end = Math.min(text.length, start + max);
  if (end < text.length && isLowSurrogate(text.charCodeAt(end))) end--;

  const before = start > 0 ? "…" : "";
  const after = end < text.length ? "…" : "";
  const shift = before.length - start;
  const kept: Range[] = [];
  for (const range of ranges) {
    const from = Math.max(range.start, start);
    const to = Math.min(range.end, end);
    if (from < to) kept.push({ start: from + shift, end: to + shift });
  }
  return { text: before + text.slice(start, end) + after, ranges: kept };
}

/** Whether a note matches every term: a "#" term by its tags, any other in its title or one of its lines. */
function matches(doc: NoteDoc, terms: readonly string[]): boolean {
  return terms.every((term) => {
    if (term.startsWith("#")) {
      const prefix = term.slice(1);
      return doc.tags.some((tag) => tag.key.startsWith(prefix));
    }
    return doc.foldedTitle.includes(term) || doc.folded.some((line) => line.includes(term));
  });
}

function hitOf(note: Note, doc: NoteDoc, terms: readonly string[]): SearchHit {
  const hit: SearchHit = { note, title: doc.title, titleRanges: rangesIn(doc.foldedTitle, terms) };
  let first = -1;
  let more = 0;
  doc.folded.forEach((folded, index) => {
    if (!terms.some((term) => folded.includes(term))) return;
    if (first < 0) first = index;
    else more++;
  });
  if (first < 0) return hit;

  const source = doc.lines[first];
  const ranges = rangesIn(doc.folded[first], terms);
  const word = source.text.slice(ranges[0].start, ranges[0].end);
  const cut = cutLine(source.text, ranges);
  hit.line = { text: cut.text, ranges: cut.ranges, more, word };
  if (source.label !== undefined) hit.line.label = source.label;
  if (source.mono) hit.line.mono = true;
  if (source.tabId !== undefined) hit.line.tabId = source.tabId;
  return hit;
}

/**
 * The notes that hold every typed word, as hits split by the open category; null when nothing is typed. `notes` come
 * in the order they should be shown, which both groups keep. Hidden notes count only while they are shown.
 */
export function searchNotes(
  notes: readonly Note[],
  docOf: (note: Note) => NoteDoc,
  text: string,
  scope: SearchScope
): SearchResult | null {
  const terms = parseQuery(text);
  if (!terms.length) return null;

  const result: SearchResult = { terms, here: [], elsewhere: [], tags: [] };
  const visible = scope.showHidden ? notes : notes.filter((note) => !note.hidden);

  if (terms.length === 1 && terms[0].startsWith("#")) {
    result.tags = tagCounts(
      (function* () {
        for (const note of visible) yield docOf(note);
      })(),
      terms[0].slice(1)
    );
  }

  // A lone "#" is ignored among other terms, and alone matches no note.
  const words = terms.filter((term) => term !== "#");
  if (!words.length) return result;

  for (const note of visible) {
    const doc = docOf(note);
    if (!matches(doc, words)) continue;
    const hit = hitOf(note, doc, words);
    if (scope.categoryIcon === null || note.category?.icon === scope.categoryIcon) result.here.push(hit);
    else result.elsewhere.push(hit);
  }
  return result;
}
