import { useEffect, useMemo, useState } from "react";

import { docOf, warmUp } from "@/libs/search/cache";
import { parseQuery, searchNotes } from "@/libs/search/search";
import type { SearchResult, SearchScope } from "@/libs/search/search";
import type { Note } from "@/types";

/** How long after the last keystroke the typed text is searched. */
const SEARCH_DELAY_MS = 100;

/**
 * The home's search: null while nothing is typed. The typed text takes effect 100 ms after the last keystroke; clearing
 * it, at once. The notes' lines are filled while the app is idle, after the home has drawn, so the first keystroke doesn't
 * pay for them.
 */
export function useNoteSearch(notes: readonly Note[], text: string, scope: SearchScope): SearchResult | null {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => warmUp(notes), [notes]);

  // Cleared: the normal list at once, not 100 ms later. Searched by its terms, so a space more doesn't search again.
  const query = text.trim() ? parseQuery(settled).join(" ") : "";
  const { categoryIcon, showHidden } = scope;
  return useMemo(
    () => searchNotes(notes, docOf, query, { categoryIcon, showHidden }),
    [notes, query, categoryIcon, showHidden]
  );
}
