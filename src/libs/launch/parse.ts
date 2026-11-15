import type { NoteType } from "@/types";

/*
 * What may open the app from outside (spec D.1, ADR-043): a short list of links, matched exactly. Everything else, a route
 * of the app included, opens the home and nothing more. Pure: no React, no store.
 *
 *   <scheme>://launch/new/<text|todo|kanban|code>   a new note of that type
 *   <scheme>://launch/dictate                       a new text note, dictating
 *   <scheme>://launch/note/<id>                     that note
 *   <scheme>://expo-sharing                         something shared into the app (expo-sharing)
 *
 * The same without the scheme, as a path ("/launch/…" or "launch/…"): the router may hand over either. One trailing slash
 * is accepted. The scheme is matched with its case; a query, a fragment, an empty or extra segment, and nothing is decoded.
 */

export type LaunchAction =
  | { kind: "new"; type: NoteType }
  | { kind: "dictate" }
  | { kind: "note"; id: string }
  | { kind: "share" };

const NOTE_TYPES: readonly NoteType[] = ["text", "todo", "kanban", "code"];
/** A note's id as the app makes them (and nothing a path could hide in). */
const NOTE_ID = /^[A-Za-z0-9~_-]{1,80}$/;

/** The part after the scheme, or the path; null when the scheme isn't one of `schemes`. */
function pathOf(link: string, schemes: readonly string[]): string | null {
  const at = link.indexOf("://");
  if (at === -1) return link.startsWith("/") ? link.slice(1) : link;
  if (!schemes.includes(link.slice(0, at))) return null;
  const rest = link.slice(at + 3);
  // "scheme:///launch": three slashes
  return rest.startsWith("/") ? null : rest;
}

/** What a link from outside asks for, or null (the home). `schemes`: this build's own, matched exactly. */
export function parseLaunch(link: unknown, schemes: readonly string[]): LaunchAction | null {
  try {
    if (typeof link !== "string") return null;
    let path = pathOf(link, schemes);
    if (!path || /[?#]/.test(path)) return null;
    if (path.endsWith("/")) path = path.slice(0, -1);
    const parts = path.split("/");
    if (parts.some((part) => !part)) return null;

    if (parts.length === 1 && parts[0] === "expo-sharing") return { kind: "share" };
    if (parts[0] !== "launch") return null;
    if (parts.length === 2 && parts[1] === "dictate") return { kind: "dictate" };
    if (parts.length !== 3) return null;
    if (parts[1] === "new" && (NOTE_TYPES as readonly string[]).includes(parts[2])) {
      return { kind: "new", type: parts[2] as NoteType };
    }
    if (parts[1] === "note" && NOTE_ID.test(parts[2])) return { kind: "note", id: parts[2] };
    return null;
  } catch {
    return null;
  }
}

/** The link shortcuts, widgets and notifications use for an action. */
export function launchUrl(scheme: string, action: Exclude<LaunchAction, { kind: "share" }>): string {
  switch (action.kind) {
    case "new":
      return `${scheme}://launch/new/${action.type}`;
    case "dictate":
      return `${scheme}://launch/dictate`;
    case "note":
      return `${scheme}://launch/note/${action.id}`;
  }
}
