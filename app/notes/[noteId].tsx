import NoteCodeEditor from "@/components/notes/NoteCodeEditor";
import NoteKanbanEditor from "@/components/notes/NoteKanbanEditor";
import NoteTextEditor from "@/components/notes/NoteTextEditor";
import NoteTodoEditor from "@/components/notes/NoteTodoEditor";
import type { VersionPreview } from "@/components/notes/VersionBand";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { addTrail } from "@/libs/diagnostics";
import { listVersions, readVersion, type VersionBody, type VersionMeta } from "@/libs/history";
import { withBody } from "@/libs/history/limits";
import { consumeUnlockedNote } from "@/libs/registry";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { getNote } from "@/slicers/notesSlice";
import type { AppDispatch } from "@/slicers/store";
import { restoreVersion } from "@/slicers/thunks/restoreVersion";
import type { CodeNote, KanbanNote, Note, TextNote, TodoNote } from "@/types";
import type { NoteType } from "@/types/note";
import { formatDateTime } from "@/utils/date";
import { isKnownNoteType } from "@/utils/noteType";
import { toast } from "@/utils/toast";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

export default function NoteScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const { noteId, version: versionId } = useLocalSearchParams<{ noteId: string; version?: string }>();
  const currentNote = useSelector(getNote(noteId));
  const dispatch = useDispatch<AppDispatch>();
  const currentCategory = useSelector(getCurrentCategory);

  const noteIdRef = useRef<string | string[]>(noteId);

  const note = useMemo(() => {
    const newNoteIds = ["new-text", "new-todo", "new-kanban", "new-code"] as const;
    type NewNoteId = (typeof newNoteIds)[number];

    if (newNoteIds.includes(noteId as NewNoteId)) {
      const noteTypeMap: Record<NewNoteId, NoteType> = {
        "new-text": "text",
        "new-todo": "todo",
        "new-kanban": "kanban",
        "new-code": "code",
      };
      const noteType = noteTypeMap[noteId as NewNoteId];

      // A single timestamp for both fields: the editors detect "brand-new" via
      // `createdAt === updatedAt`, so two separate `Date.now()` calls could
      // differ by a millisecond and silently disable the autofocus.
      const now = Date.now();

      const baseNote = {
        id: uuid(),
        type: noteType,
        title: "",
        createdAt: now,
        updatedAt: now,
        date: formatDateTime(),
        category: currentCategory,
        important: false,
        readOnly: false,
        hidden: false,
        locked: false,
      };

      if (noteType === "text") {
        return { ...baseNote, text: "" };
      } else if (noteType === "todo") {
        return { ...baseNote, list: [{ id: uuid(), text: "", checked: false }] };
      } else if (noteType === "kanban") {
        // Pre-create the first card so the board has something to autofocus
        // (mirrors todo's empty list item and code's empty tab).
        return {
          ...baseNote,
          columns: [{ id: uuid(), name: "", color: "#EEE78E", items: [{ id: uuid(), text: "", createdAt: now }] }],
        };
      } else {
        const tabId = uuid();
        return { ...baseNote, tabs: [{ id: tabId, title: "", code: "", language: "javascript" }], activeTabId: tabId };
      }
    } else {
      return currentNote;
    }
    // By the category's icon, not its object: a sync rebuilds the category objects, and a new note's id (with what was
    // typed in it) must not change under the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, currentCategory?.icon]);

  useEffect(() => {
    if (noteIdRef.current !== noteId) {
      noteIdRef.current = noteId;

      if (!note && noteId !== "new-text" && noteId !== "new-todo" && noteId !== "new-kanban" && noteId !== "new-code") {
        console.warn(`Note with id ${noteId} not found`);
        router.replace("/home");
      }
    }
  }, [noteId, note, router]);

  // A note of a type this version can't open (spec 5.5), reached by its address: home, saying why. Nothing is rendered
  // and nothing in it is touched.
  const unknownType = !!note && !isKnownNoteType(note.type);
  useEffect(() => {
    if (!unknownType) return;
    toast(t("note.update_to_open"));
    router.replace("/home");
  }, [unknownType, noteId, router, t]);

  /*
   * A protected note asks for the secret code however its screen was reached (LL-085): a card that just asked for it
   * leaves a pass (`consumeUnlockedNote`), anything else (a link, a shortcut) asks here. Decided when the note is first
   * shown, per note: one locked while open isn't asked again. While asked it renders nothing; leaving the code screen
   * without the code, or a refused fingerprint, goes home. The return check reads refs, not state: a screen is frozen while
   * unfocused, so the state set from the code screen may not have rendered yet when focus comes back.
   */
  const { unlockWithSecret } = useSecret();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per note, as it was when it was first shown
  const passed = useMemo(() => !currentNote?.locked || consumeUnlockedNote(noteId), [noteId]);
  const [unlockedId, setUnlockedId] = useState<string | null>(null);
  const unlockedIdRef = useRef<string | null>(null);
  const askedIdRef = useRef<string | null>(null);
  const unlockWithSecretRef = useRef(unlockWithSecret);
  const routerRef = useRef(router);
  useEffect(() => {
    unlockWithSecretRef.current = unlockWithSecret;
    routerRef.current = router;
  });

  useFocusEffect(
    useCallback(() => {
      if (unknownType || passed || unlockedIdRef.current === noteId) return;
      if (askedIdRef.current !== noteId) {
        askedIdRef.current = noteId;
        unlockWithSecretRef.current(
          () => {
            unlockedIdRef.current = noteId;
            setUnlockedId(noteId);
          },
          "goBack",
          () => routerRef.current.replace("/home")
        );
        return;
      }
      routerRef.current.replace("/home");
    }, [noteId, passed, unknownType])
  );

  /*
   * A kept version (spec B.9, `?version=<id>` from the history): the live note with the version's title and content, read
   * only, in the type's editor with the band. Built once, when read: nothing the editor does reaches the store. A
   * version that can't be read, or a note that is gone: back, saying so.
   */
  const [kept, setKept] = useState<{ meta: VersionMeta; body: VersionBody } | null>(null);
  useEffect(() => {
    if (!versionId) return;
    let live = true;
    Promise.all([listVersions(noteId), readVersion(noteId, versionId)]).then(([metas, body]) => {
      if (!live) return;
      const meta = metas.find((v) => v.id === versionId);
      if (meta && body) setKept({ meta, body });
      else {
        toast(t("note.not_found"));
        routerRef.current.back();
      }
    });
    return () => {
      live = false;
    };
  }, [noteId, versionId, t]);

  const keptNote = useMemo(
    () => (kept && currentNote ? withBody({ ...currentNote, readOnly: true } as Note, kept.body) : null),
    // the note as it was when the version was read: a restore must not change what is on screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kept]
  );
  const canRestore = !!currentNote && !currentNote.readOnly;
  const { back: goBack, dismiss } = router;
  const closeVersion = useCallback(() => goBack(), [goBack]);
  const restoreKept = useCallback(async () => {
    if (!versionId) return;
    const done = await dispatch(restoreVersion({ noteId, versionId })).unwrap();
    toast(done ? t("history.restored") : t("note.not_found"));
    // back to the note itself, which shows the restored content
    if (done) dismiss(2);
    else goBack();
  }, [dispatch, noteId, versionId, t, dismiss, goBack]);
  const preview = useMemo<VersionPreview | undefined>(
    () =>
      kept
        ? { at: kept.meta.at, reason: kept.meta.reason, canRestore, onClose: closeVersion, onRestore: restoreKept }
        : undefined,
    [kept, canRestore, closeVersion, restoreKept]
  );

  // The trail of an error (ADR-035): which kind of note was opened, never which one.
  const openedType = note && !versionId ? note.type || "text" : null;
  useEffect(() => {
    if (openedType) addTrail("note.open", { type: openedType });
  }, [noteId, openedType]);

  if (!note || unknownType || !(passed || unlockedId === noteId)) {
    return null;
  }

  if (versionId) {
    if (!keptNote || !preview) return null;
    const key = `${keptNote.id}:${versionId}`;
    switch (keptNote.type) {
      case "code":
        return <NoteCodeEditor key={key} initialNote={keptNote as CodeNote} preview={preview} />;
      case "kanban":
        return <NoteKanbanEditor key={key} initialNote={keptNote as KanbanNote} preview={preview} />;
      case "todo":
        return <NoteTodoEditor key={key} initialNote={keptNote as TodoNote} preview={preview} />;
      case "text":
        return <NoteTextEditor key={key} initialNote={keptNote as TextNote} preview={preview} />;
      default:
        return null;
    }
  }

  const noteType = note.type || "text";

  switch (noteType) {
    case "code":
      return <NoteCodeEditor key={note.id} initialNote={note as CodeNote} />;
    case "kanban":
      return <NoteKanbanEditor key={note.id} initialNote={note as KanbanNote} />;
    case "todo":
      return <NoteTodoEditor key={note.id} initialNote={note as TodoNote} />;
    case "text":
      return <NoteTextEditor key={note.id} initialNote={note as TextNote} />;
    default:
      return null;
  }
}
