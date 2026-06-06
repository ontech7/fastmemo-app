import { ICON_KEYWORDS } from "@/constants/icon-keywords";

/** Lowercase + strip diacritics so "café" matches "cafe", "università" matches "universita". */
const normalize = (str: string): string =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const EXACT = 3;
const PREFIX = 2;
const PARTIAL = 1;

/**
 * Suggest icon names for a typed category name, deterministically and offline.
 *
 * Matches the (diacritic-insensitive) query against the multilingual keyword
 * dictionary. Whitespace-tokenization covers Latin languages; the substring
 * pass covers CJK (zh, ja), where there are no word boundaries. Results are
 * ranked exact > prefix > partial and limited to `available` icons.
 */
export const suggestIcons = (query: string, available: string[], limit = 6): string[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored: { name: string; score: number }[] = [];

  for (const name of available) {
    const keywords = ICON_KEYWORDS[name];
    if (!keywords) continue;

    let score = 0;
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword);
      for (const token of tokens) {
        if (normalizedKeyword === token) score = Math.max(score, EXACT);
        else if (normalizedKeyword.startsWith(token) || token.startsWith(normalizedKeyword)) score = Math.max(score, PREFIX);
        else if (normalizedKeyword.includes(token) || token.includes(normalizedKeyword)) score = Math.max(score, PARTIAL);
      }
    }

    if (score > 0) scored.push({ name, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.name);
};
