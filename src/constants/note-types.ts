import { DocumentTextIcon, ListBulletIcon, ViewColumnsIcon } from "react-native-heroicons/outline";

export const NOTE_TYPES = [
  {
    key: "kanban",
    icon: ViewColumnsIcon,
    route: "/notes/new-kanban",
    labelKey: "note.type.kanban",
  },
  {
    key: "todo",
    icon: ListBulletIcon,
    route: "/notes/new-todo",
    labelKey: "note.type.todo",
  },
  {
    key: "text",
    icon: DocumentTextIcon,
    route: "/notes/new-text",
    labelKey: "note.type.text",
  },
];
