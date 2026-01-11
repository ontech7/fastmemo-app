import { useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { useSelector } from "react-redux";
import uuid from "react-uuid";

import { formatDateTime } from "@/utils/date";
import { useRouter } from "@/hooks/useRouter";
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
    if (noteId === "new-text" || noteId === "new-todo") {
      const noteType = noteId === "new-text" ? "text" : "todo";

      return {
        id: uuid(),
        type: noteType,
        title: "",
        [noteType === "text" ? "text" : "list"]: noteType === "text" ? "" : [{ id: uuid(), text: "", checked: false }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        date: formatDateTime(),
        category: currentCategory,
        important: false,
        readOnly: false,
        hidden: false,
        locked: false,
      };
    } else {
      return currentNote;
    }
  }, [noteId, currentCategory]);

  useEffect(() => {
    if (noteIdRef.current !== noteId) {
      noteIdRef.current = noteId;

      if (!note && noteId !== "new-text" && noteId !== "new-todo") {
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
    case "todo":
      return <NoteTodoEditor key={note.id} initialNote={note} />;
    case "text":
      return <NoteTextEditor key={note.id} initialNote={note} />;
    default:
      return null;
  }
}
