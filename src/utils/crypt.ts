import { getDEK } from "@/libs/vaultSession";
import type { CodeTab, KanbanColumn, KanbanItem, Note, TodoItem } from "@/types";
import CryptoJS from "react-native-crypto-js";

/**
 * Note content encryption for cloud sync.
 *
 * The key is the per-vault DEK held in `vaultSession` (it replaced the old
 * global build-time `SECRET_KEY`). Callers may pass `keyOverride` to use a
 * specific key — the legacy v1 -> v2 migration uses it to read data sealed with
 * the old global key.
 *
 * Authentication marker: AES-CBC is unauthenticated, so a wrong key often
 * decrypts to plausible-looking garbage WITHOUT throwing. That makes "did this
 * key decrypt correctly?" undecidable — dangerous for the migration and for sync
 * (garbage could be stored as plaintext then re-encrypted into permanent
 * garbage). To make it decidable, every field we encrypt is prefixed with
 * CONTENT_MAGIC before AES. On decrypt, content that doesn't carry the marker
 * was NOT encrypted with this key (or is legacy, pre-marker). `tryDecryptNote`
 * requires the marker and so RELIABLY rejects wrong-key data; `CryptNote.decrypt`
 * is lenient (strips the marker if present, else returns the raw text) so it can
 * still read legacy notes during migration.
 *
 * The marker is a short distinctive token that only ever exists inside the
 * decrypted plaintext in memory (never serialized — the stored value is the AES
 * ciphertext). A collision would require either a user note that literally
 * starts with this token (cosmetic at worst) or wrong-key garbage that matches
 * it byte-for-byte (~1e-19) — both negligible.
 *
 * react-native-crypto-js shares crypto-js's OpenSSL AES format, so notes
 * round-trip across devices/platforms and the migration interops.
 */

const CONTENT_MAGIC = "=FMV1=enc=";

export const isSecretPassphraseCorrect = (bytes: CryptoJS.lib.WordArray): boolean => {
  try {
    const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
    JSON.parse(convertedBytes);
  } catch (e) {
    return false;
  }
  return true;
};

/** Resolve the encryption key: an explicit override (migration) or the active session DEK. */
const resolveKey = (keyOverride?: string): string | null => keyOverride ?? getDEK();

/** Encrypt one field: prepend the marker, then AES. */
const encField = (plain: string, key: string): string => CryptoJS.AES.encrypt(CONTENT_MAGIC + plain, key).toString();

/**
 * Lenient decrypt: strip the marker if present (current format); otherwise return
 * the decrypted text as-is (legacy, pre-marker) — or the original ciphertext if
 * decryption throws. Used by CryptNote.decrypt (incl. the migration's legacy read).
 */
const decFieldLenient = (value: string, key: string): string => {
  try {
    const out = CryptoJS.AES.decrypt(value, key).toString(CryptoJS.enc.Utf8);
    // current format carries the marker; legacy notes don't — return their raw
    // decrypted text as-is (including a legitimately empty body). Decryption
    // failures throw and are handled below, so we never mistake "" for an error.
    return out.startsWith(CONTENT_MAGIC) ? out.slice(CONTENT_MAGIC.length) : out;
  } catch {
    return value;
  }
};

export const CryptNote = {
  encrypt: (note: Note, keyOverride?: string): Note => {
    const key = resolveKey(keyOverride);

    // Fail closed: never emit plaintext as if it were ciphertext. Call sites
    // must gate on an unlocked vault (see notesSlice queueCloud*); this guard
    // catches any path that forgot to.
    if (!key) {
      throw new Error("CryptNote.encrypt called without an unlocked vault key");
    }

    const type = note?.type || "text";

    if (type === "text" && "text" in note) {
      return { ...note, text: encField(note.text, key) };
    }

    if (type === "todo" && "list" in note) {
      const noteTodoList: TodoItem[] = note.list.map((todo) => ({ ...todo, text: encField(todo.text, key) }));
      return { ...note, list: noteTodoList };
    }

    if (type === "kanban" && "columns" in note) {
      const columns: KanbanColumn[] = (note.columns || []).map((column) => ({
        ...column,
        items: (column.items || []).map((item: KanbanItem) => ({
          ...item,
          text: item.text ? encField(item.text, key) : item.text,
        })),
      }));
      return { ...note, columns };
    }

    if (type === "code" && "tabs" in note) {
      const tabs: CodeTab[] = (note.tabs || []).map((tab: CodeTab) => ({
        ...tab,
        code: tab.code ? encField(tab.code, key) : tab.code,
        title: tab.title ? encField(tab.title, key) : tab.title,
      }));
      return { ...note, tabs };
    }

    return { ...note } as Note;
  },

  decrypt: (note: Note, keyOverride?: string): Note => {
    const key = resolveKey(keyOverride);

    // Without a key we cannot decrypt; leave the note as-is rather than crash.
    if (!key) {
      return { ...note };
    }

    const type = note?.type || "text";

    if (type === "text" && "text" in note) {
      return { ...note, text: decFieldLenient(note.text, key) };
    }

    if (type === "todo" && "list" in note) {
      const noteTodoList: TodoItem[] = note.list.map((todo) => ({ ...todo, text: decFieldLenient(todo.text, key) }));
      return { ...note, list: noteTodoList };
    }

    if (type === "kanban" && "columns" in note) {
      const columns: KanbanColumn[] = (note.columns || []).map((column) => ({
        ...column,
        items: (column.items || []).map((item: KanbanItem) => {
          if (!item?.text) return item;
          return { ...item, text: decFieldLenient(item.text, key) };
        }),
      }));
      return { ...note, columns };
    }

    if (type === "code" && "tabs" in note) {
      const tabs: CodeTab[] = (note.tabs || []).map((tab: CodeTab) => ({
        ...tab,
        code: tab.code ? decFieldLenient(tab.code, key) : tab.code,
        title: tab.title ? decFieldLenient(tab.title, key) : tab.title,
      }));
      return { ...note, tabs };
    }

    return { ...note } as Note;
  },
};

/**
 * Strict decrypt: returns the decrypted note only if EVERY non-empty field
 * carries the authentication marker (i.e. was encrypted with this exact key);
 * otherwise null. Used to reliably reject notes encrypted under a different DEK
 * so the migration skips (never overwrites) them and sync never stores ciphertext
 * as plaintext. Legacy (pre-marker) notes are intentionally treated as "not ours"
 * here — the migration reads them via CryptNote.decrypt with the legacy key.
 */
export const tryDecryptNote = (note: Note, key: string): Note | null => {
  let failed = false;

  const dec = (value?: string): string => {
    if (!value) return value ?? "";
    try {
      const out = CryptoJS.AES.decrypt(value, key).toString(CryptoJS.enc.Utf8);
      if (!out.startsWith(CONTENT_MAGIC)) {
        failed = true;
        return value;
      }
      return out.slice(CONTENT_MAGIC.length);
    } catch {
      failed = true;
      return value;
    }
  };

  const type = note?.type || "text";
  let result: Note;

  if (type === "text" && "text" in note) {
    result = { ...note, text: dec(note.text) };
  } else if (type === "todo" && "list" in note) {
    result = { ...note, list: note.list.map((todo) => ({ ...todo, text: dec(todo.text) })) };
  } else if (type === "kanban" && "columns" in note) {
    result = {
      ...note,
      columns: (note.columns || []).map((column) => ({
        ...column,
        items: (column.items || []).map((item: KanbanItem) => (item?.text ? { ...item, text: dec(item.text) } : item)),
      })),
    };
  } else if (type === "code" && "tabs" in note) {
    result = {
      ...note,
      tabs: (note.tabs || []).map((tab: CodeTab) => ({
        ...tab,
        code: tab.code ? dec(tab.code) : tab.code,
        title: tab.title ? dec(tab.title) : tab.title,
      })),
    };
  } else {
    result = { ...note } as Note;
  }

  return failed ? null : result;
};
