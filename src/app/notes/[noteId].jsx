import { useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

import { formatDateTime } from "@/utils/date";
import { useRouter } from "@/hooks/useRouter";
import NoteKanbanEditor from "@/components/notes/NoteKanbanEditor";
import NoteTextEditor from "@/components/notes/NoteTextEditor";
import NoteTodoEditor from "@/components/notes/NoteTodoEditor";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { getNote } from "@/slicers/notesSlice";

export default function NoteScreen() {
  const router = useRouter();

  const { noteId } = useLocalSearchParams();
  const currentNote = useSelector(getNote(noteId));
  const currentCategory = useSelector(getCurrentCategory);

  const noteIdRef = useRef(noteId);

  const note = useMemo(() => {
    if (noteId === "new-text" || noteId === "new-todo" || noteId === "new-kanban") {
      const noteType = noteId === "new-text" ? "text" : noteId === "new-todo" ? "todo" : "kanban";

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
      } else {
        return { ...baseNote, columns: [{ id: uuid(), name: "", color: "#EEE78E", items: [] }] };
      }
    } else {
      return currentNote;
    }
  }, [noteId, currentCategory]);

  useEffect(() => {
    if (noteIdRef.current !== noteId) {
      noteIdRef.current = noteId;

      if (!note && noteId !== "new-text" && noteId !== "new-todo" && noteId !== "new-kanban") {
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
    case "kanban":
      return <NoteKanbanEditor key={note.id} initialNote={note} />;
    case "todo":
      return <NoteTodoEditor key={note.id} initialNote={note} />;
    case "text":
      return <NoteTextEditor key={note.id} initialNote={note} />;
    default:
      return null;
  }
}
