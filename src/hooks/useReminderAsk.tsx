import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";
import { useDispatch, useSelector, useStore } from "react-redux";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import { askToNotify, exactAlarmState, notifyState, openExactAlarmSettings } from "@/libs/reminders";
import { isUpcoming } from "@/libs/reminders/plan";
import { getAllNotes } from "@/slicers/notesSlice";
import { selectorReminderSettings, setReminderSettings } from "@/slicers/settingsSlice";

import type { RootState } from "@/types";

type Shown = "denied" | "exact" | null;

/**
 * What a phone asks so that a reminder rings (spec D.5): the system's notification question the first time, the app's
 * dialog when notifications are off (the reminder stays on the note), then once per install the "be on time" question
 * when the exact-alarm access is missing. Android only; elsewhere nothing. `dialogs` goes in the screen's tree.
 */
export function useReminderAsk() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const [shown, setShown] = useState<Shown>(null);

  const ask = useCallback(async () => {
    if (Platform.OS !== "android") return;
    let state = await notifyState();
    if (state === "askable") state = (await askToNotify()) ? "granted" : "denied";
    if (state === "denied") {
      setShown("denied");
      return;
    }
    if (store.getState().settings.reminders?.exactAsked) return;
    if ((await exactAlarmState()) !== "denied") return;
    dispatch(setReminderSettings({ exactAsked: true }));
    setShown("exact");
  }, [dispatch, store]);

  const close = () => setShown(null);

  const dialogs = (
    <>
      <ComplexDialog
        open={shown === "denied"}
        title={t("reminder.denied_title")}
        description={t("reminder.denied_text")}
        confirm={{
          label: t("reminder.open_settings"),
          handler: () => {
            close();
            Linking.openSettings().catch(() => {});
          },
        }}
        cancel={{ label: t("ok"), handler: close }}
        onDismiss={close}
      />
      <ComplexDialog
        open={shown === "exact"}
        title={t("reminder.exact_title")}
        description={t("reminder.exact_text")}
        confirm={{
          label: t("reminder.open_settings"),
          handler: () => {
            close();
            openExactAlarmSettings();
          },
        }}
        cancel={{ label: t("reminder.not_now"), handler: close }}
        onDismiss={close}
      />
    </>
  );

  return { ask, dialogs };
}

/**
 * A reminder that came through sync on a phone never asked (spec D.5): the system's question is never shown on its own;
 * the home asks first, once, whatever the answer. After "Not now" the question comes back when a reminder is set on this
 * phone (`useReminderAsk`). Android only.
 */
export function useReminderSyncQuestion() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const notes = useSelector(getAllNotes);
  const { syncAsked } = useSelector(selectorReminderSettings);
  const { ask, dialogs } = useReminderAsk();
  const [open, setOpen] = useState(false);
  const askedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android" || askedRef.current || syncAsked) return;
    const now = Date.now();
    if (!notes.some((note) => isUpcoming(note, now))) return;
    notifyState()
      .then((state) => {
        if (state !== "askable" || askedRef.current) return;
        askedRef.current = true;
        setOpen(true);
      })
      .catch(() => {});
  }, [notes, syncAsked]);

  const answer = () => {
    setOpen(false);
    dispatch(setReminderSettings({ syncAsked: true }));
  };

  return (
    <>
      <ComplexDialog
        open={open}
        title={t("reminder.ask_sync_title")}
        description={t("reminder.ask_sync_text")}
        confirm={{
          label: t("ok"),
          handler: () => {
            answer();
            ask();
          },
        }}
        cancel={{ label: t("reminder.not_now"), handler: answer }}
      />
      {dialogs}
    </>
  );
}
