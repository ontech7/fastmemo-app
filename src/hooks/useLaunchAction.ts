import { type Href, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { addTrail } from "@/libs/diagnostics";
import { onPendingLaunch, planLaunch, setDictateOnOpen, setHomeShown, takePendingLaunch } from "@/libs/launch";
import { flushPending, storeUnlockedNote } from "@/libs/registry";
import { getNote } from "@/slicers/notesSlice";
import { selectorShowHidden } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import { toast } from "@/utils/toast";

import type { RootState } from "@/types";

/**
 * The home carries out a launch action (a link, a shortcut, a widget, a notification: `@/libs/launch`) when it has the
 * focus: one that arrives while another screen is on top waits for the home. The open note's edits are committed first.
 */
export function useLaunchAction(): void {
  const { t } = useTranslation();
  const router = useRouter();
  const { unlockWithSecret } = useSecret();
  const focusedRef = useRef(false);

  const run = useCallback(() => {
    if (!focusedRef.current) return;
    const action = takePendingLaunch();
    if (!action) return;
    addTrail("launch", { kind: action.kind });
    flushPending();
    const state = store.getState() as RootState;
    const step = planLaunch(action, {
      // the home is reached only after the intro, and the start screen drops an action that came before it (app/index.tsx)
      introFinished: true,
      showHidden: selectorShowHidden(state),
      findNote: (id) => getNote(id)(state),
    });
    switch (step.do) {
      case "notFound":
        toast(t("note.not_found"));
        return;
      case "open": {
        // a route planLaunch builds from the allow-list: the new-note routes and /notes/<id>
        const route = step.route as Href;
        if (step.dictate) setDictateOnOpen();
        if (!step.askCode) {
          router.push(route);
          return;
        }
        const id = action.kind === "note" ? action.id : "";
        const locked = !!getNote(id)(state)?.locked;
        // As a card does (NoteCard): the code once, then the note; a locked one isn't asked again (LL-085).
        unlockWithSecret((codeRouter, isFingerprint) => {
          if (locked) storeUnlockedNote(id);
          if (isFingerprint) codeRouter.push(route);
          else codeRouter.replace(route);
        }, "none");
        return;
      }
      // "nothing" (the intro isn't finished); "share" comes with the sharing (Task 35)
      default:
        return;
    }
  }, [router, t, unlockWithSecret]);

  useFocusEffect(
    useCallback(() => {
      setHomeShown();
      focusedRef.current = true;
      run();
      const off = onPendingLaunch(run);
      return () => {
        focusedRef.current = false;
        off();
      };
    }, [run])
  );
}
