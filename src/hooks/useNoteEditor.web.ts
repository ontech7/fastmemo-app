import { storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { webhook } from "@/utils/webhook";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

interface UseNoteEditorOptions<T extends Note> {
  initialNote: T;
  defaultType: NoteType;
  addWebhookSelector: (state: RootState) => WebhookPayload;
  addAction: string;
  isEmpty: (note: T) => boolean;
  buildPayloadExtras: (note: T) => Record<string, unknown>;
}

interface UseNoteEditorResult<T extends Note> {
  note: T;
  setNote: React.Dispatch<React.SetStateAction<T>>;
  setNoteAsync: (currNote: T) => void;
  updateNoteWebhook: () => Promise<void>;
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

  /* --- Explicit back button handler (no hardwareBackPress on web) --- */

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

  return { note, setNote, setNoteAsync, updateNoteWebhook };
}
