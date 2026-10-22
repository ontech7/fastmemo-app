import { selectorTourStep } from "@/slicers/settingsSlice";
import type { RootState } from "@/types";
import { useState } from "react";
import { useStore } from "react-redux";

/**
 * Whether an editor puts the cursor in its note when it opens (decided then): a brand-new note that isn't read-only.
 * Not under the first-note tour's step in the editor: the keyboard would come up and the typing go on under the dimmed
 * screen, before "Got it".
 */
export function useAutofocusNewNote(note: { createdAt: number; updatedAt: number; readOnly?: boolean }): boolean {
  const store = useStore<RootState>();
  const [autofocus] = useState(() => {
    const tour = selectorTourStep(store.getState());
    return note.createdAt === note.updatedAt && !note.readOnly && tour !== "create" && tour !== "write";
  });
  return autofocus;
}
