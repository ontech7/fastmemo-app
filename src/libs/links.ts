/** The schemes a link of a note may have: a page, an email address, a phone number. */
const ALLOWED = /^(https?|mailto|tel):/i;
/** Any scheme: what isn't one of the four is refused. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** A host and a port with nothing before them (`localhost:3000/x`): not a scheme. */
const HOST_PORT = /^[^/:@]+:\d+(\/|$)/;
/** `name@host`, with no scheme and no `/`. */
const EMAIL = /^[^@/:\s]+@[^@/:\s]+$/;
/** A user name (and password) before the host of a web address. */
const CREDENTIALS = /^https?:\/\/[^/?#]*@/i;

/**
 * The address a link may hold, or null: http, https, mailto and tel only; no scheme means https, and a bare email address
 * is a mailto. Never another scheme (`javascript:`, `file:`, `data:`, the app's own), a name and password before the host,
 * or white space inside.
 */
export function normalizeLink(input: string): string | null {
  const link = input.trim();
  if (!link || /\s/.test(link)) return null;
  if (ALLOWED.test(link)) return CREDENTIALS.test(link) ? null : link;
  if (EMAIL.test(link)) return `mailto:${link}`;
  if (HOST_PORT.test(link)) return `https://${link}`;
  if (SCHEME.test(link) || link.includes("@")) return null;
  return `https://${link}`;
}

/** What a link to another note holds as its address. */
export const NOTE_LINK_PREFIX = "#fm-note-";
export const noteLinkHref = (noteId: string) => NOTE_LINK_PREFIX + noteId;

const NOTE_LINK = /^#fm-note-([A-Za-z0-9~_-]{1,80})$/;

/** The note id a link's address names (1 to 80 characters of `A-Z a-z 0-9 ~ _ -`), or null for any other address. */
export function noteLinkId(href: string): string | null {
  return NOTE_LINK.exec(href)?.[1] ?? null;
}
