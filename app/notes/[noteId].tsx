import NoteCodeEditor from "@/components/notes/NoteCodeEditor";
import NoteKanbanEditor from "@/components/notes/NoteKanbanEditor";
import NoteTextEditor from "@/components/notes/NoteTextEditor";
import NoteTodoEditor from "@/components/notes/NoteTodoEditor";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { addTrail } from "@/libs/diagnostics";
import { consumeUnlockedNote } from "@/libs/registry";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { getNote } from "@/slicers/notesSlice";
import type { CodeNote, KanbanNote, TextNote, TodoNote } from "@/types";
import type { NoteType } from "@/types/note";
import { formatDateTime } from "@/utils/date";
import { isKnownNoteType } from "@/utils/noteType";
import { toast } from "@/utils/toast";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

export default function NoteScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const currentNote = useSelector(getNote(noteId));
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

  // The trail of an error (ADR-035): which kind of note was opened, never which one.
  const openedType = note ? note.type || "text" : null;
  useEffect(() => {
    if (openedType) addTrail("note.open", { type: openedType });
  }, [noteId, openedType]);

  if (!note || unknownType || !(passed || unlockedId === noteId)) {
    return null;
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
