import * as Notifications from "expo-notifications";
import i18n, { t as translate } from "i18next";
import { AppState } from "react-native";

import { openWhenHome } from "@/libs/launch";
import { notifyStateOf, planReminders } from "@/libs/reminders/plan";
import { setReminderSettings } from "@/slicers/settingsSlice";

import type { NotifyState, Scheduled } from "@/libs/reminders/plan";
import type { RootState } from "@/types";
import type { Store } from "@reduxjs/toolkit";

/*
 * The phone rings at a note's reminder (spec D.5, ADR-044). Local only: the library schedules and shows, no push token is
 * ever asked. One notification per note (`fm-reminder-<id>`, scheduling again replaces it); what to schedule and cancel is
 * `planReminders`, this file only carries it out. A protected or hidden note's title is put nowhere in its notification.
 */

const PREFIX = "fm-reminder-";
const CHANNEL = "reminders";
const COLOR = "#4F6BFF";
/** Notes change in bursts (typing): one reconcile 2 s after the last change. */
const SETTLE_MS = 2000;

let store: Store<RootState> | null = null;
let chain: Promise<void> = Promise.resolve();

const t = (key: string) => translate(key);

const displayTitle = (title: string) => (title.trim() ? title : t("empty_title"));

const ensureChannel = () =>
  Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t("reminder.channel"),
    // eslint-disable-next-line import/namespace -- re-exported through `export *`, which the rule doesn't follow
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: COLOR,
  });

const bodyOf = (isPrivate: boolean) => (isPrivate ? t("reminder.notification_private") : t("reminder.notification_body"));

const toScheduled = (request: Notifications.NotificationRequest): Scheduled | null => {
  if (!request.identifier.startsWith(PREFIX)) return null;
  const data = (request.content.data ?? {}) as { at?: unknown; private?: unknown };
  const isPrivate = data.private === true;
  return {
    noteId: request.identifier.slice(PREFIX.length),
    at: typeof data.at === "number" ? data.at : NaN,
    private: isPrivate,
    title: isPrivate ? "" : (request.content.title ?? ""),
  };
};

const schedule = (item: Scheduled) =>
  Notifications.scheduleNotificationAsync({
    identifier: PREFIX + item.noteId,
    content: {
      title: item.private ? t("reminder.notification_title") : item.title,
      body: bodyOf(item.private),
      data: { noteId: item.noteId, at: item.at, private: item.private },
      color: COLOR,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL },
  });

async function reconcileNow(force: boolean): Promise<void> {
  if (!store) return;
  const state = store.getState();
  const live = state.notes.items.map((note) => ({
    id: note.id,
    title: displayTitle(note.title),
    remindAt: note.remindAt,
    locked: note.locked,
    hidden: note.hidden,
  }));
  const requests = (await Notifications.getAllScheduledNotificationsAsync()).filter((r) => r.identifier.startsWith(PREFIX));
  const exact = (await exactAlarmState()) !== "denied";
  const settings = state.settings.reminders ?? {};
  // Everything again when asked, when the exact-alarm access changed, or when a text is in another language.
  const stale =
    force ||
    (settings.exact !== undefined && settings.exact !== exact) ||
    requests.some((r) => r.content.body !== bodyOf((r.content.data as { private?: unknown })?.private === true));
  const scheduled = requests.map(toScheduled).filter((item): item is Scheduled => item !== null);
  const plan = planReminders(live, stale ? [] : scheduled, Date.now());
  const cancel = stale ? scheduled.map((item) => item.noteId) : plan.cancel;
  for (const noteId of cancel) await Notifications.cancelScheduledNotificationAsync(PREFIX + noteId);
  for (const item of plan.schedule) await schedule(item);
  if (settings.exact !== exact) store.dispatch(setReminderSettings({ exact }));
}

/** Schedules and cancels the difference between the notes and what this phone has scheduled. `force`: everything again. */
export function reconcileReminders(force = false): Promise<void> {
  chain = chain.then(() => reconcileNow(force)).catch(() => {});
  return chain;
}

/** A notification tapped: its note, the way a link to it opens (a protected one asks its code). */
const handled = new Set<string>();
const openFrom = (response: Notifications.NotificationResponse | null) => {
  if (!response) return;
  const { request, date } = response.notification;
  const key = `${request.identifier}:${date}`;
  if (handled.has(key)) return;
  handled.add(key);
  const noteId = (request.content.data as { noteId?: unknown })?.noteId;
  if (typeof noteId === "string") openWhenHome({ kind: "note", id: noteId });
};

/**
 * After the home has drawn: the channel, the tap listener, a first reconcile, then one whenever notes change (2 s after
 * the last change) and when the app comes back to the front. Returns the function that stops it.
 */
export function startReminders(appStore: Store<RootState>): () => void {
  store = appStore;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ensureChannel().catch(() => {});

  const tapped = Notifications.addNotificationResponseReceivedListener(openFrom);
  // The tap that started the app: read once, then forgotten.
  const launching = Notifications.getLastNotificationResponse();
  if (launching) {
    openFrom(launching);
    Notifications.clearLastNotificationResponse();
  }

  reconcileReminders();

  let notes = appStore.getState().notes.items;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = appStore.subscribe(() => {
    const next = appStore.getState().notes.items;
    if (next === notes) return;
    notes = next;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => reconcileReminders(), SETTLE_MS);
  });
  const front = AppState.addEventListener("change", (status) => {
    if (status === "active") reconcileReminders();
  });
  const onLanguage = () => {
    ensureChannel().catch(() => {});
    reconcileReminders(true);
  };
  i18n.on("languageChanged", onLanguage);

  return () => {
    tapped.remove();
    unsubscribe();
    front.remove();
    i18n.off("languageChanged", onLanguage);
    if (timer) clearTimeout(timer);
    store = null;
  };
}

export async function notifyState(): Promise<NotifyState> {
  return notifyStateOf(await Notifications.getPermissionsAsync());
}

/** The system's question (the channel exists first, as Android wants). */
export async function askToNotify(): Promise<boolean> {
  await ensureChannel().catch(() => {});
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function exactAlarmState(): Promise<"granted" | "denied" | "unneeded"> {
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted ? "granted" : "denied";
  } catch {
    return "unneeded";
  }
}

/** The system's "Alarms and reminders" screen for the app. */
export async function openExactAlarmSettings(): Promise<void> {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {}
}
