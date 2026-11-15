import { fold } from "./fold";
import type { NoteDoc } from "./lines";

export interface Tag {
  /** Folded, without the "#": what is compared. */
  key: string;
  /** As written, lower-cased: what is shown. */
  label: string;
}

export interface TagCount extends Tag {
  /** How many notes hold it. */
  count: number;
}

/**
 * A tag: "#", a letter, then up to 39 letters, digits, "_" or "-", at the start of a line or after white space, and not
 * followed by another such character (a longer word is not a tag cut short).
 */
const TAG = /(^|\s)#(\p{L}[\p{L}\p{N}_-]{0,39})(?![\p{L}\p{N}_-])/gu;
/** A colour, not a tag: exactly 3, 6 or 8 hexadecimal digits. */
const HEX_COLOUR = /^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Whether a word (without its "#") can be a tag: what isn't (`123`, a colour) is searched as text. */
export function canBeTag(word: string): boolean {
  return /^\p{L}[\p{L}\p{N}_-]{0,39}$/u.test(word) && !HEX_COLOUR.test(word);
}

/** The tags in a text, distinct by key, in the order they appear. */
export function tagsIn(text: string): Tag[] {
  const seen = new Set<string>();
  const tags: Tag[] = [];
  for (const match of text.matchAll(TAG)) {
    const word = match[2];
    if (HEX_COLOUR.test(word)) continue;
    const key = fold(word);
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({ key, label: word.toLowerCase() });
  }
  return tags;
}

/**
 * The tags whose key starts with `prefix` (already folded, without "#"), most used first, then by key. A tag's count is
 * the notes its search finds, so what a tap on it shows: a tag search matches by the beginning, and `#casa` also finds the
 * notes tagged `#casalinga`. When notes spell a tag differently, the first spelling met is shown.
 */
export function tagCounts(docs: Iterable<NoteDoc>, prefix: string): TagCount[] {
  const found = new Map<string, TagCount>();
  const noteKeys: string[][] = [];
  for (const doc of docs) {
    const keys: string[] = [];
    for (const tag of doc.tags) {
      if (!tag.key.startsWith(prefix)) continue;
      keys.push(tag.key);
      if (!found.has(tag.key)) found.set(tag.key, { ...tag, count: 0 });
    }
    if (keys.length) noteKeys.push(keys);
  }
  for (const tag of found.values()) {
    for (const keys of noteKeys) if (keys.some((key) => key.startsWith(tag.key))) tag.count++;
  }
  return [...found.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
