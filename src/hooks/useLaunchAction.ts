import { type Href, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { noteTextLimit } from "@/libs/cloud";
import { addTrail } from "@/libs/diagnostics";
import { onPendingLaunch, planLaunch, setDictateOnOpen, setHomeShown, takePendingLaunch } from "@/libs/launch";
import { clearShare, receiveShare } from "@/libs/launch/receiveShare";
import { flushPending, storeUnlockedNote } from "@/libs/registry";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { addNote, getNote } from "@/slicers/notesSlice";
import { selectorDeveloperMode, selectorShowHidden, selectorWebhook_addTextNote } from "@/slicers/settingsSlice";
import { store } from "@/slicers/store";
import { formatDateTime } from "@/utils/date";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";
import uuid from "react-uuid";

import type { RootState, TextNote } from "@/types";
import type { TFunction } from "i18next";

/**
 * A share to the app becomes a new text note, made as the quick note makes one (the home's category, `updatedAt` one past
 * `createdAt`: it opens as an existing note), then opened. The share is forgotten as soon as the note is in the store, so
 * that nothing makes it twice; one with nothing to keep is forgotten too.
 */
async function noteFromIncomingShare(t: TFunction, open: (route: Href) => void): Promise<void> {
  const state = store.getState() as RootState;
  const devMode = selectorDeveloperMode(state);
  const received = await receiveShare(devMode.enabled && devMode.unlimitedTextSpace ? null : noteTextLimit(false));
  if (!received) {
    clearShare();
    toast(t("share.nothing"));
    return;
  }
  if (received.unreadable) toast(t("note.image.not_added"));
  if (received.overLimit) toast(t("noteLimitReached"));
  if (!received.html) {
    clearShare();
    return;
  }

  const id = uuid();
  const now = Date.now();
  const category = getCurrentCategory(store.getState() as RootState);
  const note: TextNote = {
    id,
    type: "text",
    title: received.title,
    category,
    date: formatDateTime(),
    createdAt: now,
    updatedAt: now + 1,
    important: false,
    locked: false,
    readOnly: false,
    hidden: false,
    deleteDate: null,
    text: received.html,
  };
  store.dispatch(addNote(note));
  clearShare();
  webhook(selectorWebhook_addTextNote(store.getState() as RootState), {
    action: "note/addTextNote",
    id,
    type: "text",
    title: received.title,
    createdAt: now,
    updatedAt: now + 1,
    important: false,
    readOnly: false,
    hidden: false,
    locked: false,
    category: category ? { iconId: category.icon, name: category.name } : undefined,
    text: received.html,
  });
  open(`/notes/${id}` as Href);
}

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
      case "share":
        noteFromIncomingShare(t, (route) => router.push(route)).catch(() => clearShare());
        return;
      // "nothing": the intro isn't finished (a share is forgotten then)
      default:
        if (action.kind === "share") clearShare();
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
