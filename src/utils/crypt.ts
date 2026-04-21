import { configs } from "@/configs";
import type { CodeTab, KanbanColumn, KanbanItem, Note, TodoItem } from "@/types";
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

    if (type === "code" && "tabs" in note) {
      const tabs: CodeTab[] = (note.tabs || []).map((tab: CodeTab) => ({
        ...tab,
        code: tab.code ? CryptoJS.AES.encrypt(tab.code, configs.cloud.secretKey).toString() : tab.code,
        title: tab.title ? CryptoJS.AES.encrypt(tab.title, configs.cloud.secretKey).toString() : tab.title,
      }));
      return { ...note, tabs };
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

    if (type === "code" && "tabs" in note) {
      const tabs: CodeTab[] = (note.tabs || []).map((tab: CodeTab) => {
        const code = tab.code ? CryptoJS.AES.decrypt(tab.code, configs.cloud.secretKey).toString(CryptoJS.enc.Utf8) : tab.code;
        const title = tab.title
          ? CryptoJS.AES.decrypt(tab.title, configs.cloud.secretKey).toString(CryptoJS.enc.Utf8)
          : tab.title;
        return { ...tab, code, title };
      });
      return { ...note, tabs };
    }

    return { ...note } as Note;
  },
};
