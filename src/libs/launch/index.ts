import { router } from "expo-router";

import { setPendingLaunch } from "@/libs/launch/pending";

import type { LaunchAction } from "@/libs/launch/parse";

export { launchUrl, parseLaunch, type LaunchAction } from "@/libs/launch/parse";
export { onPendingLaunch, setPendingLaunch, takePendingLaunch } from "@/libs/launch/pending";
export { planLaunch, type LaunchStep } from "@/libs/launch/plan";

/*
 * What may open the app from outside (spec D.1, ADR-043). Links reach the app through `app/+native-intent.ts`: the one that
 * starts the app keeps the action and goes to "/", one that arrives while it runs comes through `requestLaunch`, as a
 * notification's tap does. The home carries the action out (`useLaunchAction`).
 */

let homeShown = false;

/** The home calls it when it first appears: from then on it is in the stack, under whatever is on top. */
export function setHomeShown(): void {
  homeShown = true;
}

/**
 * While the app runs: brings the home to the front, then leaves the action (none: only the home). In this order: the home
 * on top takes it at once, one under another screen when it is back on top; left first, the home on top would open the
 * new screen and the navigation would close it. Before the home's first focus (the app starting, as when Android brings
 * back a killed process in its kept task and hands the link over as a new intent, or the intro) the action only waits:
 * the home takes it when it appears, and going to the home now would skip the intro (LL-095).
 */
export function requestLaunch(action: LaunchAction | null): void {
  if (!homeShown) {
    if (action) setPendingLaunch(action);
    return;
  }
  router.dismissTo("/home");
  if (action) setPendingLaunch(action);
}

let dictateOnOpen = false;

/** One slot, like the find word's: a new text note opened by "dictate" starts the dictation sheet. */
export function setDictateOnOpen(): void {
  dictateOnOpen = true;
}

/** Once: true when the new text note opening now was asked to dictate. */
export function takeDictateOnOpen(): boolean {
  const asked = dictateOnOpen;
  dictateOnOpen = false;
  return asked;
}
