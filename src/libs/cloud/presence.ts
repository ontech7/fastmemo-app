import { useSyncExternalStore } from "react";

import { PRESENCE_TTL_MS, type CloudDevice } from "./types";

/*
 * Which note each other device has open (ADR-016), from the device list the sync engine reports.
 */

let state = { others: [] as CloudDevice[], now: Date.now() };
let ticker: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = () => listeners.forEach((listener) => listener());

/** The device list as the engine last saw it. */
export const setPresenceDevices = (devices: CloudDevice[], me: string): void => {
  state = { others: devices.filter((device) => device.uuid !== me), now: Date.now() };

  // While a note is open somewhere, time moves on every minute: a presence that went stale disappears.
  const anyOpen = state.others.some((device) => device.presence?.noteId);
  if (anyOpen && !ticker) {
    ticker = setInterval(() => {
      state = { ...state, now: Date.now() };
      notify();
    }, 60_000);
  } else if (!anyOpen && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  notify();
};

export const clearPresenceDevices = (): void => setPresenceDevices([], "");

const deviceName = (device: CloudDevice) =>
  device.modelName && device.modelName !== "Unknown" ? device.modelName : device.brand || "web";

/** The names of the other devices that have this note open, joined (empty: none). */
const openElsewhere = (noteId: string): string =>
  state.others
    .filter((device) => device.presence?.noteId === noteId && state.now - device.presence.at < PRESENCE_TTL_MS)
    .map(deviceName)
    .join(", ");

/** Which other devices have this note open, e.g. "Pixel 8" (empty string: none). Re-renders only when that changes. */
export const useNoteOpenElsewhere = (noteId: string): string => useSyncExternalStore(subscribe, () => openElsewhere(noteId));
