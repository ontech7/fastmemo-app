import { configs } from "@/configs";
import type { KanbanColumn, KanbanItem, Note, TodoItem } from "@/types";
import CryptoJS from "react-native-crypto-js";

export const isSecretPassphraseCorrect = (bytes: CryptoJS.lib.WordArray): boolean => {
  try {
    const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
    JSON.parse(convertedBytes);
  } catch (e) {
    return false;
  }
  return true;
};

export const CryptNote = {
  encrypt: (note: Note): Note => {
    const type = note?.type || "text";

    if (type === "text" && "text" in note) {
      const noteText = CryptoJS.AES.encrypt(note.text, configs.cloud.secretKey).toString();
      return { ...note, text: noteText };
    }

    if (type === "todo" && "list" in note) {
      const noteTodoList: TodoItem[] = [];
      note.list.forEach((todo) =>
        noteTodoList.push({
          ...todo,
          text: CryptoJS.AES.encrypt(todo.text, configs.cloud.secretKey).toString(),
        })
      );
      return { ...note, list: noteTodoList };
    }

    if (type === "kanban" && "columns" in note) {
      const columns: KanbanColumn[] = (note.columns || []).map((column) => ({
        ...column,
        items: (column.items || []).map((item: KanbanItem) => ({
          ...item,
          text: item.text ? CryptoJS.AES.encrypt(item.text, configs.cloud.secretKey).toString() : item.text,
        })),
      }));
      return { ...note, columns };
    }

    return { ...note } as Note;
  },

  decrypt: (note: Note): Note => {
    const type = note?.type || "text";

    if (type === "text" && "text" in note) {
      const bytes = CryptoJS.AES.decrypt(note.text, configs.cloud.secretKey);
      const noteText = bytes.toString(CryptoJS.enc.Utf8);
      return { ...note, text: noteText };
    }

    if (type === "todo" && "list" in note) {
      const noteTodoList: TodoItem[] = [];
      note.list.forEach((todo) => {
        const bytes = CryptoJS.AES.decrypt(todo.text, configs.cloud.secretKey);
        const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
        noteTodoList.push({ ...todo, text: convertedBytes });
      });
      return { ...note, list: noteTodoList };
    }

    if (type === "kanban" && "columns" in note) {
      const columns: KanbanColumn[] = (note.columns || []).map((column) => ({
        ...column,
        items: (column.items || []).map((item: KanbanItem) => {
          if (!item?.text) return item;

          const bytes = CryptoJS.AES.decrypt(item.text, configs.cloud.secretKey);
          const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
          return { ...item, text: convertedBytes };
        }),
      }));
      return { ...note, columns };
    }

    return { ...note } as Note;
  },
};
