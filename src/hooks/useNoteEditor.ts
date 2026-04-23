import { storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { webhook } from "@/utils/webhook";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";

import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

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
}

interface UseNoteEditorResult<T extends Note> {
  note: T;
  /** Raw state setter. Prefer `setNoteAsync` to keep webhook + dirty tracking in sync. */
  setNote: React.Dispatch<React.SetStateAction<T>>;
  /** Persists the note (Redux add or temp+delete), stores the dirty id and updates local state. */
  setNoteAsync: (currNote: T) => void;
  /** Called on hardware back press / explicit back button press. Fires the update/delete webhook. */
  updateNoteWebhook: () => Promise<void>;
}

/**
 * Shared behaviour for the four note editor screens (Text, Todo, Kanban, Code) on native.
 *
 * Handles:
 * - common webhook selectors (update / delete / temporary delete)
 * - "newly created" add webhook fire-once effect
 * - dirty-id tracking via the registry
 * - local note state + `setNoteAsync` that also dispatches to Redux
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
}: UseNoteEditorOptions<T>): UseNoteEditorResult<T> {
  const dispatch = useDispatch();

  const webhook_add = useSelector(addWebhookSelector);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const [note, setNote] = useState<T>(initialNote);

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

  /* --- Dirty tracking + wrapped setter --- */

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
  }, [note.id]);

  useEffect(() => {
    return () => {
      dirtyRef.current = false;
    };
  }, []);

  const setNoteAsync = useCallback(
    (currNote: T) => {
      if (!dirtyRef.current) {
        storeDirtyNoteId(currNote.id);
        dirtyRef.current = true;
      }

      setNote(currNote);

      if (isEmpty(currNote)) {
        dispatch(temporaryDeleteNote(currNote.id));
        dispatch(deleteNote(currNote.id));
        return;
      }

      dispatch(
        addNote({
          ...currNote,
          type: currNote.type || defaultType,
          updatedAt: Date.now(),
          date: formatDateTime(),
        } as Note)
      );
    },
    [dispatch, isEmpty, defaultType]
  );

  /* --- Back/webhook handler --- */

  const updateNoteWebhook = useCallback(async () => {
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
  }, [note, webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote, isEmpty, buildWebhookPayload]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      KeyboardController.dismiss();
      Keyboard.dismiss();
      return false;
    });

    return () => backHandler.remove();
  }, [updateNoteWebhook]);

  /* --- Keyboard dismissal on focus loss --- */

  useFocusEffect(
    useCallback(() => {
      return () => {
        KeyboardController.dismiss();
        Keyboard.dismiss();
      };
    }, [])
  );

  return { note, setNote, setNoteAsync, updateNoteWebhook };
}
