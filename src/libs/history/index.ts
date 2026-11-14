import { reportHandled } from "@/libs/diagnostics";
import type { Note } from "@/types";
import { runWhenIdle } from "@/utils/idle";

import { createHistoryBackend } from "./backend";
import { isKnownType, type VersionBody, type VersionMeta, type VersionReason } from "./limits";
import { createHistory, type History } from "./store";

export type { VersionBody, VersionMeta, VersionReason } from "./limits";

/*
 * The app's one history of note versions (spec B.9), on this device only. Its failures are reported as handled ones
 * (area `history`), never with content: a version not kept never stops what the person is doing.
 */

let history: History | null = null;
const theHistory = () =>
  (history ??= createHistory(createHistoryBackend(), Date.now, (error) => reportHandled("history", error)));

/** Keeps the note as it is in this object, when the app is idle. Returns at once, never throws. */
export function keepVersion(note: Note, reason: VersionReason): void {
  if (!note || !isKnownType(note.type)) return;
  runWhenIdle(() => {
    void theHistory().keep(note, reason);
  });
}

export const listVersions = (noteId: string): Promise<VersionMeta[]> => theHistory().list(noteId);

export const readVersion = (noteId: string, versionId: string): Promise<VersionBody | null> =>
  theHistory().read(noteId, versionId);

export const wipeHistory = (): Promise<void> => theHistory().wipe();

/** What the history reads of the app's store. */
export interface AppStore {
  getState(): { notes: { items: Note[]; temporaryItems: Note[]; purged?: Record<string, number> } };
  subscribe(listener: () => void): () => void;
}

const SWEEP_AFTER_MS = 5000;
let swept = false;

/** Drops a note's versions when it is deleted for good, and sweeps once. Returns the function that stops it. */
export function startHistory(store: AppStore): () => void {
  let purged = store.getState().notes.purged;
  const unsubscribe = store.subscribe(() => {
    const next = store.getState().notes.purged;
    if (next === purged) return;
    const before = purged ?? {};
    purged = next;
    for (const id of Object.keys(next ?? {})) if (!(id in before)) void theHistory().dropNote(id);
  });
  const timer = swept
    ? undefined
    : setTimeout(() => {
        swept = true;
        const { items, temporaryItems } = store.getState().notes;
        void theHistory().sweep(new Set([...items, ...temporaryItems].map((note) => note.id)));
      }, SWEEP_AFTER_MS);
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
