/** Combining marks of the Latin, Greek and Cyrillic accents (U+0300 to U+036F): only these are taken off. */
const ACCENTS = /^[\u0300-\u036f]+$/;

/**
 * Lower case, accents off, and exactly as long as the text given: position i of the result is position i of the text, so
 * a range found in the folded text marks the same characters in the original.
 *
 * One code point at a time: one whose canonical decomposition is a base followed only by those marks becomes the base
 * (so kana with a voicing mark and Korean syllables are not taken apart); then lower case. Either step is kept only when
 * it doesn't change the code point's length.
 */
export function fold(text: string): string {
  let out = "";
  for (const char of text) {
    let folded = char;
    const parts = char.normalize("NFD");
    if (parts.length > char.length) {
      const base = String.fromCodePoint(parts.codePointAt(0) as number);
      if (base.length === char.length && ACCENTS.test(parts.slice(base.length))) folded = base;
    }
    const lower = folded.toLowerCase();
    out += lower.length === folded.length ? lower : folded;
  }
  return out;
}
