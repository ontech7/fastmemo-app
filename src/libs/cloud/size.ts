import { configs } from "@/configs";

/*
 * How big a note may be (ADR-026). Each cloud has its own limit on a note as it's sent, encrypted: Firestore's document
 * limit, or the FastMemo server's MAX_NOTE_MB. A note over it isn't sent: it becomes device-only (offline).
 */

/** The largest encrypted note Firestore takes: its documents hold 1 MiB, field names and the document's name included. */
export const FIRESTORE_NOTE_MAX_BYTES = 1_000_000;

/** What an encrypted note holds besides its encrypted text: its other fields, the title (96 characters at most). */
const NOTE_FIELDS_BYTES = 4096;

/** The UTF-8 bytes of `value` as JSON: how both clouds measure a note against their limit. */
export const jsonBytes = (value: unknown): number => {
  const json = JSON.stringify(value ?? null);
  let bytes = json.length;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    // 2 bytes up to U+07FF, 3 up to U+FFFF; a surrogate pair (2 code units) is 4.
    if (code >= 0xd800 && code <= 0xdfff) bytes += 1;
    else if (code > 0x7ff) bytes += 2;
    else if (code > 0x7f) bytes += 1;
  }
  return bytes;
};

/**
 * The most text (the UTF-8 bytes of its HTML) a note can hold where the cloud takes `maxNoteBytes` per encrypted note:
 * encryption writes the text in base64, a third bigger. Null `maxNoteBytes` (no cloud, or its limit not known yet): the
 * app's own limit.
 */
export const textLimitFor = (maxNoteBytes: number | null): number =>
  maxNoteBytes === null ? configs.notes.sizeLimit : Math.max(0, Math.floor(((maxNoteBytes - NOTE_FIELDS_BYTES) * 3) / 4));
