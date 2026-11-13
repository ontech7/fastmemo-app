import type { Note } from "@/types";

import { noteDoc } from "./lines";
import type { NoteDoc } from "./lines";

/** Kept against the note object: a changed note is a new object in the store, so nothing is ever stale or cleared. */
const docs = new WeakMap<Note, NoteDoc>();
/** The most a warm-up slice runs, so a frame is never held up. */
const SLICE_MS = 4;

/** `noteDoc(note)`, computed once per note object. */
export function docOf(note: Note): NoteDoc {
  let doc = docs.get(note);
  if (!doc) {
    doc = noteDoc(note);
    docs.set(note, doc);
  }
  return doc;
}

/** Whether this note object's lines are already kept. */
export function hasDoc(note: Note): boolean {
  return docs.has(note);
}

const idle = (run: () => void) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(run);
  else setTimeout(run, 16);
};

/**
 * Fills the cache while the app is idle, in slices of at most 4 ms that never stop in the middle of a note; a note already
 * kept costs one lookup. Nothing is read inside the call itself. Returns a function that stops it.
 */
export function warmUp(notes: readonly Note[], schedule: (run: () => void) => void = idle): () => void {
  let next = 0;
  let stopped = false;
  const slice = () => {
    if (stopped) return;
    const started = performance.now();
    while (next < notes.length) {
      docOf(notes[next++]);
      if (performance.now() - started >= SLICE_MS) break;
    }
    if (next < notes.length && !stopped) schedule(slice);
  };
  schedule(slice);
  return () => {
    stopped = true;
  };
}
