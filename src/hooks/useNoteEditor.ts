import { flushNow } from "@/libs/flushOnExit";
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
import { AppState, BackHandler, Keyboard } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";

import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

/**
 * Edits land in local state at once, but reach Redux in batches: every commit makes redux-persist
 * re-serialize and rewrite the whole notes state (and re-encrypts the note for the cloud outbox),
 * which per keystroke made typing lag with many notes. A batch is committed once input pauses for
 * COMMIT_DEBOUNCE_MS, at least every COMMIT_MAX_WAIT_MS during continuous input, and right away
 * when the editor loses focus or unmounts, the app leaves the foreground (`flushOnExit`), an edit
 * arrives while it's in the background, or `flushNote` is called.
 */
const COMMIT_DEBOUNCE_MS = 500;
const COMMIT_MAX_WAIT_MS = 2000;

interface UseNoteEditorOptions<T extends Note> {
  /** The initial note coming from props. Used to detect "newly created" notes. */
  initialNote: T;
  /** Fallback note type used when `initialNote.type` is missing. */
  defaultType: NoteType;
  /** Selector returning the webhook configuration for the "add" action (add<Type>Note). */
  addWebhookSelector: (state: RootState) => WebhookPayload;
  /** Action string for the "add" webhook (e.g. "note/addTextNote"). */
  addAction: string;
  /** Predicate to determine whether the note is "empty" (triggers trash + delete flow). */
  isEmpty: (note: T) => boolean;
  /**
   * Type-specific fields merged into the common base payload (id, type, title, timestamps,
   * flags, category). The base payload is composed by the hook — the editor only supplies
   * what is unique to its note type (e.g. `text`, `list`, `columns`, `tabs`).
   */
  buildPayloadExtras: (note: T) => Record<string, unknown>;
  /**
   * Returns the text a brand-new, still-untitled note should derive its title from
   * (e.g. the note body, or the joined todo/kanban/code entries). While the user
   * hasn't typed a title themselves, the title mirrors the first chars of this.
   * Omit to disable auto-titling.
   */
  getTitleSource?: (note: T) => string;
}

interface UseNoteEditorResult<T extends Note> {
  note: T;
  /** Raw state setter. Prefer `setNoteAsync` to keep webhook + dirty tracking in sync. */
  setNote: React.Dispatch<React.SetStateAction<T>>;
  /** Updates local state and schedules the note's batched commit to Redux (add, or temp+delete when empty). */
  setNoteAsync: (currNote: T) => void;
  /** Commits the pending batch now, if any. Call before acting on the stored note (delete, detach, ...). */
  flushNote: () => void;
  /** Called on hardware back press / explicit back button press. Fires the update/delete webhook. */
  updateNoteWebhook: () => Promise<void>;
  /**
   * Title derived live from the content while a brand-new note is still untitled.
   * Editors surface it as the title field's placeholder; it is also what gets
   * persisted/shown in the list. Empty string once the note has a title or isn't new.
   */
  autoTitle: string;
}

/**
 * Shared behaviour for the four note editor screens (Text, Todo, Kanban, Code) on native.
 *
 * Handles:
 * - common webhook selectors (update / delete / temporary delete)
 * - "newly created" add webhook fire-once effect
 * - dirty-id tracking via the registry
 * - local note state + `setNoteAsync` that commits it to Redux in batches (see COMMIT_DEBOUNCE_MS)
 * - hardware back handler that triggers the update/delete webhook (native only)
 * - keyboard dismissal on focus loss (native only)
 *
 * A platform-split `useNoteEditor.web.ts` is picked automatically by Metro on web and
 * omits the hardware back handler and the keyboard dismissal (both are no-ops / undesired
 * dependencies on the browser).
 *
 * The common webhook payload (id, type, title, timestamps, flags, category) is composed
 * by the hook; each editor only supplies type-specific fields through `buildPayloadExtras`.
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

      // Timers don't fire in the background, where the app may also be killed at any time: an edit
      // landing there (a late editor message, an AI or voice result) is written right away.
      if (AppState.currentState !== "active") {
        flushNow();
        return;
      }

      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      const untilMaxWait = pendingSinceRef.current + COMMIT_MAX_WAIT_MS - now;
      commitTimerRef.current = setTimeout(flushNote, Math.max(0, Math.min(COMMIT_DEBOUNCE_MS, untilMaxWait)));
    },
    [flushNote]
  );

  // Never leave a batch behind: the editor goes away, or the app may be killed once in background.
  useEffect(() => () => flushNote(), [flushNote]);

  useEffect(() => registerPendingFlush(flushNote), [flushNote]);

  /* --- Back/webhook handler --- */

  const updateNoteWebhook = useCallback(async () => {
    // Commit before leaving, so the list is already up to date as it comes back into view.
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

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      KeyboardController.dismiss();
      Keyboard.dismiss();
      return false;
    });

    return () => backHandler.remove();
  }, [updateNoteWebhook]);

  /* --- Commit + keyboard dismissal on focus loss --- */

  useFocusEffect(
    useCallback(() => {
      return () => {
        flushNote();
        KeyboardController.dismiss();
        Keyboard.dismiss();
      };
    }, [flushNote])
  );

  return { note, setNote, setNoteAsync, flushNote, updateNoteWebhook, autoTitle };
}
