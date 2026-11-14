import { keepVersion as keepNoteVersion, type VersionReason } from "@/libs/history";
import { registerPendingFlush, storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { deriveNoteTitle } from "@/utils/string";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";
import { useLiveNote } from "@/hooks/useLiveNote";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector, useStore } from "react-redux";

import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

/**
 * Batched commits, as on native (see `useNoteEditor.ts`), but shorter: a desktop window can be
 * closed in ways that give the page no chance to flush (e.g. quitting the app), and serializing
 * the notes costs far less on a desktop CPU.
 */
const COMMIT_DEBOUNCE_MS = 300;
const COMMIT_MAX_WAIT_MS = 1000;

/** Whether two versions of a note hold the same values (a shallow comparison: editors replace what they change). */
const isSameNote = (a: Note, b: Note): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof Note] !== b[key as keyof Note]) return false;
  }
  return true;
};

interface UseNoteEditorOptions<T extends Note> {
  initialNote: T;
  defaultType: NoteType;
  addWebhookSelector: (state: RootState) => WebhookPayload;
  addAction: string;
  isEmpty: (note: T) => boolean;
  buildPayloadExtras: (note: T) => Record<string, unknown>;
  /** Text a brand-new, still-untitled note derives its title from. Omit to disable. */
  getTitleSource?: (note: T) => string;
  /**
   * Another device changed the open note: the hook now holds the stored version (load it into a WebView editor);
   * `previous` is the version it was showing.
   */
  onRemoteChange?: (note: T, previous: T) => void;
  /** Showing a kept version (spec B.9): nothing reaches the store, the webhooks or the sync engine. */
  preview?: boolean;
}

interface UseNoteEditorResult<T extends Note> {
  note: T;
  setNote: React.Dispatch<React.SetStateAction<T>>;
  setNoteAsync: (currNote: T) => void;
  /** As on native: an update computed from the current copy. */
  updateNoteAsync: (update: (current: T) => T) => void;
  flushNote: () => void;
  updateNoteWebhook: () => Promise<void>;
  /** Title derived from content while a new note is untitled; shown as the field placeholder. */
  autoTitle: string;
  /** Keeps the note as the editor holds it now (typed but not yet saved edits included). */
  keepVersion: (reason: VersionReason) => void;
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
  onRemoteChange,
  preview = false,
}: UseNoteEditorOptions<T>): UseNoteEditorResult<T> {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const webhook_add = useSelector(addWebhookSelector);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const [note, setNote] = useState<T>(initialNote);
  // The editor's note, synchronously (state lags a render behind).
  const currentRef = useRef<T>(initialNote);

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
  // A note that was saved before this sitting (not one created now): its first change keeps the version it opened with,
  // and emptying it sends it to the trash instead of deleting it.
  const existedRef = useRef(initialNote.createdAt !== initialNote.updatedAt);
  const editKeptRef = useRef(false);
  const emptiedRef = useRef(false);
  const store = useStore<RootState>();
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
    if (!isNewlyCreated || preview) return;

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
      if (preview) return;
      // The sitting's first change of a saved note (emptying it too): the note as it opened is kept as a version, when
      // idle (spec B.9).
      if (existedRef.current && !editKeptRef.current) {
        editKeptRef.current = true;
        keepNoteVersion(initialNote as unknown as Note, "edit");
      }

      if (isEmpty(currNote)) {
        if (!existedRef.current) {
          dispatch(temporaryDeleteNote(currNote.id));
          dispatch(deleteNote(currNote.id));
          return;
        }
        // Emptied: to the trash as it was last saved (typing again brings it back, addNote takes a trashed id back).
        if (store.getState().notes.items.some((n) => n.id === currNote.id)) {
          dispatch(temporaryDeleteNote(currNote.id));
          emptiedRef.current = true;
        }
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
    [dispatch, isEmpty, defaultType, store, initialNote, preview]
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
      const prev = currentRef.current;
      currentRef.current = currNote;
      setNote(currNote);

      // Nothing changed (e.g. an editor reporting back the content it was just reloaded with): nothing to commit.
      if (preview || isSameNote(prev, currNote)) return;

      const now = Date.now();
      if (!pendingNoteRef.current) pendingSinceRef.current = now;
      pendingNoteRef.current = currNote;

      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      const untilMaxWait = pendingSinceRef.current + COMMIT_MAX_WAIT_MS - now;
      commitTimerRef.current = setTimeout(flushNote, Math.max(0, Math.min(COMMIT_DEBOUNCE_MS, untilMaxWait)));
    },
    [flushNote, preview]
  );

  const updateNoteAsync = useCallback((update: (current: T) => T) => setNoteAsync(update(currentRef.current)), [setNoteAsync]);

  useEffect(() => () => flushNote(), [flushNote]);

  // Closed on a saved note left empty: it went to the trash, and the person is told so.
  useEffect(
    () => () => {
      if (emptiedRef.current && isEmpty(currentRef.current)) toast(t("note.emptied_to_trash"));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFocusEffect(useCallback(() => () => flushNote(), [flushNote]));

  useEffect(() => (preview ? undefined : registerPendingFlush(flushNote)), [flushNote, preview]);

  /* --- Changes from other devices (see the native variant) --- */

  useLiveNote(preview ? null : note.id, {
    onRemote: (stored) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      pendingNoteRef.current = null;

      const previous = currentRef.current;
      let next = stored as T;
      // Still untitled here: the stored title is the one derived from the content (see auto-title), not a name.
      const deriveFrom = getTitleSourceRef.current;
      if (wasNewRef.current && !previous.title.trim() && deriveFrom && next.title === deriveNoteTitle(deriveFrom(next))) {
        next = { ...next, title: "" };
      }
      currentRef.current = next;
      // Rendered, with its effects, before this returns: the editors keep the note in refs their effects update
      // (`noteRef`), and an edit typed right after (a lock or a title an agent just set) must be made on this note, not on the
      // copy it replaces: that would write it back (ADR-032). Not on native, where nothing but sync changes a note.
      flushSync(() => setNote(next));
      onRemoteChange?.(next, previous);
    },
    onDeleted: () => toast(t("cloudsync.note_deleted_elsewhere")),
  });

  /* --- Explicit back button handler (no hardwareBackPress on web) --- */

  const updateNoteWebhook = useCallback(async () => {
    if (preview) return;
    flushNote();

    if (isEmpty(note)) {
      await webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        id: note.id,
      });
      // a saved note emptied stays in the trash
      if (existedRef.current) return;
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
  }, [
    note,
    flushNote,
    webhook_updateNote,
    webhook_deleteNote,
    webhook_temporaryDeleteNote,
    isEmpty,
    buildWebhookPayload,
    preview,
  ]);

  const keepVersion = useCallback(
    (reason: VersionReason) => {
      if (!preview) keepNoteVersion(currentRef.current as unknown as Note, reason);
    },
    [preview]
  );

  return { note, setNote, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle, keepVersion };
}
