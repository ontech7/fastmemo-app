import { useCallback } from "react";

import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { storeUnlockedNote } from "@/libs/registry";
import { setFindOnOpen } from "@/libs/search/findOnOpen";
import type { HitLine } from "@/libs/search/search";

/**
 * Opens a note from the home: a card's tap and the desktop menu's Open, one path. A search result whose content matched
 * opens on its word (in memory: never in the route); a protected note asks its code first, and is unlocked here so its
 * screen doesn't ask again (LL-085).
 */
export function useOpenNote(): (id: string, locked: boolean, line?: Pick<HitLine, "word" | "tabId">) => void {
  const router = useRouter();
  const { unlockWithSecret } = useSecret();
  return useCallback(
    (id, locked, line) => {
      if (line) setFindOnOpen(id, { word: line.word, tabId: line.tabId });
      if (!locked) {
        router.push(`/notes/${id}`);
        return;
      }
      unlockWithSecret((codeRouter, isFingerprint) => {
        storeUnlockedNote(id);
        if (isFingerprint) codeRouter.push(`/notes/${id}`);
        else codeRouter.replace(`/notes/${id}`);
      }, "none");
    },
    [router, unlockWithSecret]
  );
}
