import type { NotifyState } from "@/libs/reminders/plan";
import type { RootState } from "@/types";
import type { Store } from "@reduxjs/toolkit";

/* The web app and the desktop don't ring: a reminder set there rings on the phones that have the note (spec D.5). */

export function startReminders(_store: Store<RootState>): () => void {
  return () => {};
}

export async function reconcileReminders(_force = false): Promise<void> {}

/** Nothing to allow here. */
export async function notifyState(): Promise<NotifyState> {
  return "granted";
}

export async function askToNotify(): Promise<boolean> {
  return false;
}

export async function exactAlarmState(): Promise<"granted" | "denied" | "unneeded"> {
  return "unneeded";
}

export async function openExactAlarmSettings(): Promise<void> {}
