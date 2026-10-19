import { registerPendingFlush, storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { deriveNoteTitle } from "@/utils/string";
import { webhook } from "@/utils/webhook";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

/**
 * Batched commits, as on native (see `useNoteEditor.ts`), but shorter: a desktop window can be
 * closed in ways that give the page no chance to flush (e.g. quitting the app), and serializing
 * the notes costs far less on a desktop CPU.
 */
const COMMIT_DEBOUNCE_MS = 300;
const COMMIT_MAX_WAIT_MS = 1000;

interface UseNoteEditorOptions<T extends Note> {
  initialNote: T;
  defaultType: NoteType;
  addWebhookSelector: (state: RootState) => WebhookPayload;
  addAction: string;
  isEmpty: (note: T) => boolean;
  buildPayloadExtras: (note: T) => Record<string, unknown>;
  /** Text a brand-new, still-untitled note derives its title from. Omit to disable. */
  getTitleSource?: (note: T) => string;
}

interface UseNoteEditorResult<T extends Note> {
  note: T;
  setNote: React.Dispatch<React.SetStateAction<T>>;
  setNoteAsync: (currNote: T) => void;
  flushNote: () => void;
  updateNoteWebhook: () => Promise<void>;
  /** Title derived from content while a new note is untitled; shown as the field placeholder. */
  autoTitle: string;
}

/**
 * Web variant of `useNoteEditor`.
 *
 * Mirrors the native API but drops the hardware back handler and the keyboard
 * dismissal pipeline: `BackHandler.hardwareBackPress` never fires in the browser,
 * and `react-native-keyboard-controller` is mobile-only. `updateNoteWebhook` is
 * invoked by the explicit `<BackButton />` on web instead.
 *
 * Metro resolves this file automatically when the bundle target is web.
 */
export function useNoteEditor<T extends Note>({
  initialNote,
  defaultType,
  addWebhookSelector,
  addAction,
  isEmpty,
  buildPayloadExtras,
  getTitleSource,
}: UseNoteEditorOptions<T>): UseNoteEditorResult<T> {
  const dispatch = useDispatch();

  const webhook_add = useSelector(addWebhookSelector);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const [note, setNote] = useState<T>(initialNote);

  /* --- Auto-title for brand-new, untitled notes --- */

  // A freshly created note the user never names is still persisted with a title
  // derived from its content, so it never shows up untitled in the list. The local
  // title is left empty (editors surface `autoTitle` as the field's placeholder),
  // so the user can type their own at any point and it immediately takes over —
  // no fragile syncing of a derived value back through every content update.
  const getTitleSourceRef = useRef(getTitleSource);
  useEffect(() => {
    getTitleSourceRef.current = getTitleSource;
  }, [getTitleSource]);
  const wasNewRef = useRef(initialNote.createdAt === initialNote.updatedAt);
  const autoTitle = wasNewRef.current && !note.title.trim() && getTitleSource ? deriveNoteTitle(getTitleSource(note)) : "";

  /* --- Common webhook payload composer --- */

  const buildWebhookPayload = useCallback(
    (n: T): Record<string, unknown> => ({
      id: n.id,
      type: n.type || defaultType,
      title: n.title,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      important: n.important,
      readOnly: n.readOnly,
      hidden: n.hidden,
      locked: n.locked,
      category: {
        iconId: n.category.icon,
        name: n.category.name,
      },
      ...buildPayloadExtras(n),
    }),
    [defaultType, buildPayloadExtras]
  );

  /* --- Newly created: fire add webhook once --- */

  const isNewlyCreated = note.createdAt === note.updatedAt;

  useEffect(() => {
    if (!isNewlyCreated) return;

    webhook(webhook_add, {
      action: addAction,
      ...buildWebhookPayload(note),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewlyCreated]);

  /* --- Dirty tracking + batched commits --- */

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
  }, [note.id]);

  useEffect(() => {
    return () => {
      dirtyRef.current = false;
    };
  }, []);

  const commitNote = useCallback(
    (currNote: T) => {
      if (isEmpty(currNote)) {
        dispatch(temporaryDeleteNote(currNote.id));
        dispatch(deleteNote(currNote.id));
        return;
      }

      // Marked right before the upsert that consumes it, so no other commit can take it in between.
      if (!dirtyRef.current) {
        storeDirtyNoteId(currNote.id);
        dirtyRef.current = true;
      }

      // Persist a content-derived title only while the user hasn't named this
      // brand-new note (the local title stays empty so they keep full control of
      // the field). Keying off the empty title — never a synced derived value —
      // is what keeps this correct for the list/board/code editors too.
      const deriveFrom = getTitleSourceRef.current;
      const derivedTitle =
        wasNewRef.current && !currNote.title.trim() && deriveFrom ? deriveNoteTitle(deriveFrom(currNote)) : "";

      dispatch(
        addNote({
          ...currNote,
          title: derivedTitle || currNote.title,
          type: currNote.type || defaultType,
          updatedAt: Date.now(),
          date: formatDateTime(),
        } as Note)
      );
    },
    [dispatch, isEmpty, defaultType]
  );

  const commitNoteRef = useRef(commitNote);
  useEffect(() => {
    commitNoteRef.current = commitNote;
  }, [commitNote]);

  const pendingNoteRef = useRef<T | null>(null);
  const pendingSinceRef = useRef(0);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNote = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    const pending = pendingNoteRef.current;
    if (!pending) return;

    pendingNoteRef.current = null;
    commitNoteRef.current(pending);
  }, []);

  const setNoteAsync = useCallback(
    (currNote: T) => {
      setNote(currNote);

      const now = Date.now();
      if (!pendingNoteRef.current) pendingSinceRef.current = now;
      pendingNoteRef.current = currNote;

      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      const untilMaxWait = pendingSinceRef.current + COMMIT_MAX_WAIT_MS - now;
      commitTimerRef.current = setTimeout(flushNote, Math.max(0, Math.min(COMMIT_DEBOUNCE_MS, untilMaxWait)));
    },
    [flushNote]
  );

  useEffect(() => () => flushNote(), [flushNote]);

  useFocusEffect(useCallback(() => () => flushNote(), [flushNote]));

  useEffect(() => registerPendingFlush(flushNote), [flushNote]);

  /* --- Explicit back button handler (no hardwareBackPress on web) --- */

  const updateNoteWebhook = useCallback(async () => {
    flushNote();

    if (isEmpty(note)) {
      await webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        id: note.id,
      });
      await webhook(webhook_deleteNote, {
        action: "note/deleteNote",
        id: note.id,
      });
      return;
    }

    await webhook(webhook_updateNote, {
      action: "note/updateNote",
      ...buildWebhookPayload(note),
    });
  }, [note, flushNote, webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote, isEmpty, buildWebhookPayload]);

  return { note, setNote, setNoteAsync, flushNote, updateNoteWebhook, autoTitle };
}
