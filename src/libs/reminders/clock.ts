import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { isUpcoming } from "@/libs/reminders/plan";

/*
 * The time the app judges "still to come" by (spec D.5): one clock for every card, menu and sheet. It moves when a
 * reminder shown somewhere passes (one timer, at the nearest), when the app comes back to the front, and when something
 * shows a reminder already passed that the clock hasn't seen pass (a recycled card, a note synced in). Nothing else
 * wakes it: a screen with no reminder on it has no timer.
 */

/** setTimeout's longest wait (about 24.8 days); a later reminder waits in steps. */
const MAX_DELAY = 2 ** 31 - 1;

let now = Date.now();
const listeners = new Set<() => void>();
/** The reminders shown right now, with how many places show each. */
const watched = new Map<number, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let frontListening = false;

/** The nearest time still to come, or null. */
export function nextWake(times: Iterable<number>, at: number): number | null {
  let next: number | null = null;
  for (const time of times) if (time > at && (next === null || time < next)) next = time;
  return next;
}

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
  arm();
}

function arm() {
  if (timer) clearTimeout(timer);
  timer = null;
  const next = nextWake(watched.keys(), now);
  if (next === null) return;
  timer = setTimeout(tick, Math.min(next - Date.now() + 1, MAX_DELAY));
}

function listenToFront() {
  if (frontListening) return;
  frontListening = true;
  AppState.addEventListener("change", (status) => {
    if (status === "active") tick();
  });
}

export function subscribeClock(listener: () => void): () => void {
  listenToFront();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const clockNow = () => now;

/** A reminder shown somewhere: the clock wakes when it passes. Returns the function that stops watching it. */
export function watchReminder(at: number): () => void {
  listenToFront();
  watched.set(at, (watched.get(at) ?? 0) + 1);
  if (at <= Date.now() && at > now) setTimeout(tick, 0);
  else arm();
  return () => {
    const count = (watched.get(at) ?? 1) - 1;
    if (count > 0) watched.set(at, count);
    else watched.delete(at);
    arm();
  };
}

/** Whether a note's reminder is still to come, redrawn the moment it passes. */
export function useReminderUpcoming(remindAt: number | undefined): boolean {
  const upcoming = useSyncExternalStore(subscribeClock, () => isUpcoming({ remindAt }, now));
  useEffect(() => (typeof remindAt === "number" ? watchReminder(remindAt) : undefined), [remindAt]);
  return upcoming;
}
