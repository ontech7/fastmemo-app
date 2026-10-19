import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useStore } from "react-redux";

import type { SyncEngine } from "@/libs/cloud/syncEngine";
import { getSyncEngine, onSyncEvent } from "@/libs/cloud/sync";

import type { Note, RootState } from "@/types";

interface LiveNoteHandlers {
  /** Another device's change was merged into the note: the stored version, to show instead. */
  onRemote: (note: Note) => void;
  /** Another device moved the note to the trash. */
  onDeleted: () => void;
}

/**
 * For an open note editor (ADR-016): follows the changes other devices make to the note while it's open, and shows the
 * other devices that it's open here (while the app is in the foreground).
 *
 * The sync engine commits the editor's pending edits before merging, so what `onRemote` gets already accounts for them
 * (as the note itself, or as a conflict copy when both sides changed it).
 */
export function useLiveNote(noteId: string, handlers: LiveNoteHandlers): void {
  const store = useStore<RootState>();

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(
    () =>
      onSyncEvent((event) => {
        if (event.type !== "applied" || !event.changed.includes(noteId)) return;
        const { items, temporaryItems } = store.getState().notes;
        const stored = items.find((n) => n.id === noteId);
        if (stored) handlersRef.current.onRemote(stored);
        else if (temporaryItems.some((n) => n.id === noteId)) handlersRef.current.onDeleted();
      }),
    [noteId, store]
  );

  useEffect(() => {
    let engine: SyncEngine | null = null;
    let mounted = true;
    // Only a note the others have: not a device-only one (theirs, with the same id, is another note), nor one not saved yet.
    const shared = () => store.getState().notes.items.some((note) => note.id === noteId && !note.local);
    const show = (open: boolean) => {
      if (open && shared()) engine?.setPresence(noteId);
      else engine?.releasePresence(noteId);
    };

    getSyncEngine().then((e) => {
      engine = e;
      if (mounted) show(AppState.currentState === "active");
    });
    const subscription = AppState.addEventListener("change", (state) => show(state === "active"));

    return () => {
      mounted = false;
      subscription.remove();
      show(false);
    };
  }, [noteId, store]);
}
