import NoteCodeEditor from "@/components/notes/NoteCodeEditor";
import NoteKanbanEditor from "@/components/notes/NoteKanbanEditor";
import NoteTextEditor from "@/components/notes/NoteTextEditor";
import NoteTodoEditor from "@/components/notes/NoteTodoEditor";
import { useRouter } from "@/hooks/useRouter";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { getNote } from "@/slicers/notesSlice";
import type { CodeNote, KanbanNote, TextNote, TodoNote } from "@/types";
import type { NoteType } from "@/types/note";
import { formatDateTime } from "@/utils/date";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

export default function NoteScreen() {
  const router = useRouter();

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

      const baseNote = {
        id: uuid(),
        type: noteType,
        title: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
        return { ...baseNote, columns: [{ id: uuid(), name: "", color: "#EEE78E", items: [] }] };
      } else {
        const tabId = uuid();
        return { ...baseNote, tabs: [{ id: tabId, title: "", code: "", language: "javascript" }], activeTabId: tabId };
      }
    } else {
      return currentNote;
    }
  }, [noteId, currentCategory]);

  useEffect(() => {
    if (noteIdRef.current !== noteId) {
      noteIdRef.current = noteId;

      if (!note && noteId !== "new-text" && noteId !== "new-todo" && noteId !== "new-kanban" && noteId !== "new-code") {
        console.warn(`Note with id ${noteId} not found`);
        router.replace("/home");
      }
    }
  }, [noteId, note, router]);

  if (!note) {
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
