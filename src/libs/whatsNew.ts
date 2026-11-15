import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The news of a new version. After an update the home says so in a message at the bottom, which then flies into the
 * sidebar and stays there as an icon until the changelog is opened (from the icon, the message or the settings). Nothing
 * covers the home: people open a notes app to write.
 *
 * On this device only: `@appVersion` is the version last announced (written at once, so the message shows one time),
 * `@whatsNewPending` the version whose changelog hasn't been opened yet (the icon, across launches). A new install writes
 * `@appVersion` when its secret code is set: nothing to announce.
 */

export type WhatsNewPhase = "none" | "message" | "icon";

const APP_VERSION_KEY = "@appVersion";
const PENDING_KEY = "@whatsNewPending";

/** The message comes this long after the home shows, and stays this long before it flies to the sidebar (ms). */
export const WHATS_NEW_DELAY = 600;
export const WHATS_NEW_HOLD = 2500;

/** What to show, from what this device remembers (null: never written). Pure, for the tests. */
export const whatsNewPhase = (lastAnnounced: string | null, pending: string | null, current: string): WhatsNewPhase => {
  if (lastAnnounced !== current) return "message";
  return pending === current ? "icon" : "none";
};

let phase: WhatsNewPhase = "none";
/** The icon arrives from the message (it lands), not from a launch where it was already waiting. */
let landed = false;
const listeners = new Set<() => void>();

const set = (next: WhatsNewPhase, fromMessage = false): void => {
  if (phase === next && landed === fromMessage) return;
  phase = next;
  landed = fromMessage;
  listeners.forEach((l) => l());
};

export const getWhatsNewPhase = (): WhatsNewPhase => phase;
export const whatsNewLanded = (): boolean => landed;

export const subscribeWhatsNew = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let checking: Promise<void> | null = null;

const check = async (current: string): Promise<void> => {
  let last: string | null;
  let pending: string | null;
  try {
    [last, pending] = await Promise.all([AsyncStorage.getItem(APP_VERSION_KEY), AsyncStorage.getItem(PENDING_KEY)]);
  } catch {
    return;
  }
  const next = whatsNewPhase(last, pending, current);
  if (next === "message") {
    try {
      await Promise.all([AsyncStorage.setItem(APP_VERSION_KEY, current), AsyncStorage.setItem(PENDING_KEY, current)]);
    } catch {
      return;
    }
  }
  set(next);
};

/**
 * Reads what this device remembers and sets the phase, once per launch: the home mounting again (or React running its
 * effects twice in development) must not read back what the first check wrote and skip the message. A read that fails
 * shows nothing and writes nothing (LL-039): the news waits for the next launch.
 */
export const checkWhatsNew = (current: string): Promise<void> => (checking ??= check(current));

/** The message is done (flown, or left behind when the home went away): the icon stays in the sidebar. */
export const landWhatsNew = (flew: boolean): void => {
  if (phase === "message") set("icon", flew);
};

/** The changelog was opened: the icon goes, for good. */
export const seenWhatsNew = (): void => {
  set("none");
  AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
};

/** The sidebar's slot the message flies to, measured through the views registry the tour uses (useTourTarget). */
export const WHATS_NEW_TARGET = "whatsNew";
