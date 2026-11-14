import type { CodeTab, KanbanColumn, Note, NoteType, TodoItem, TodoMode } from "@/types";

/*
 * The history of a note's versions (spec B.9), pure: what a version holds, when one is kept, and which go to keep within
 * the limits. Nothing here touches a store.
 */

/**
 * Why a version was kept: before an AI change, an agent's edit, another device's text, a stretch of editing, a replace
 * all, a delete of the completed items, a restore of another version.
 */
export type VersionReason = "ai" | "agent" | "sync" | "edit" | "replace" | "cleanup" | "restore";

export interface VersionMeta {
  id: string;
  noteId: string;
  at: number;
  reason: VersionReason;
  /** The body's JSON length in characters (for pictures, which are base64, their bytes). */
  size: number;
  /** `hashText` of the body's JSON. */
  hash: string;
}

/** What a version holds of a note: its title and its content. Never flags, category, dates or revisions. */
export interface VersionBody {
  type: NoteType;
  title: string;
  text?: string;
  list?: TodoItem[];
  mode?: TodoMode;
  columns?: KanbanColumn[];
  tabs?: CodeTab[];
  activeTabId?: string;
}

export const MAX_VERSIONS = 20;
export const MAX_NOTE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 200 * 1024 * 1024;
export const BURST_MS = 10 * 60 * 1000;

/** The content keys of each type, in the order a body is written. */
const CONTENT: Record<NoteType, readonly (keyof VersionBody)[]> = {
  text: ["text"],
  todo: ["list", "mode"],
  kanban: ["columns"],
  code: ["tabs", "activeTabId"],
};

export const isKnownType = (type: unknown): type is NoteType =>
  typeof type === "string" && Object.prototype.hasOwnProperty.call(CONTENT, type);

export function bodyOf(note: Note): VersionBody {
  const body: VersionBody = { type: note.type, title: note.title ?? "" };
  const source = note as unknown as Record<string, unknown>;
  for (const key of CONTENT[note.type] ?? []) {
    if (source[key] !== undefined) (body as unknown as Record<string, unknown>)[key] = source[key];
  }
  return body;
}

/** The note as it is now, with the version's title and content. null when the types differ. */
export function withBody(note: Note, body: VersionBody): Note | null {
  if (note.type !== body.type) return null;
  const next = { ...note, title: body.title } as unknown as Record<string, unknown>;
  for (const key of CONTENT[note.type] ?? []) {
    const value = (body as unknown as Record<string, unknown>)[key];
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as unknown as Note;
}

/** `kept`: the note's versions, newest first. */
export function shouldKeep(kept: readonly VersionMeta[], next: { at: number; reason: VersionReason; hash: string }): boolean {
  const newest = kept[0];
  if (!newest) return true;
  if (newest.hash === next.hash) return false;
  // a stretch of editing waits for the newest of any reason; every other reason only for its own
  const last = next.reason === "edit" ? newest : kept.find((v) => v.reason === next.reason);
  return !last || next.at - last.at >= BURST_MS;
}

/** The ids to drop from one note's versions (newest first) so that 20 and 5 MB hold, oldest first. Never the newest. */
export function toDropForNote(kept: readonly VersionMeta[]): string[] {
  let size = 0;
  let keep = 0;
  for (const [i, version] of kept.entries()) {
    if (i > 0 && (i >= MAX_VERSIONS || size + version.size > MAX_NOTE_SIZE)) break;
    size += version.size;
    keep = i + 1;
  }
  return kept
    .slice(keep)
    .map((v) => v.id)
    .reverse();
}

const byAge = (a: VersionMeta, b: VersionMeta) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The versions to drop, oldest first across all notes, until 200 MB holds. A note's newest can go too. */
export function toDropForTotal(all: readonly VersionMeta[]): VersionMeta[] {
  let total = all.reduce((sum, v) => sum + v.size, 0);
  const drop: VersionMeta[] = [];
  for (const version of [...all].sort(byAge)) {
    if (total <= MAX_TOTAL_SIZE) break;
    drop.push(version);
    total -= version.size;
  }
  return drop;
}

/** The live notes whose text a sync plan is about to replace with different title or content, in `live`'s order. */
export function replacedByPlan(live: readonly Note[], put: readonly Note[]): Note[] {
  const incoming = new Map(put.map((note) => [note.id, note]));
  return live.filter((note) => {
    const next = incoming.get(note.id);
    return !!next && JSON.stringify(bodyOf(note)) !== JSON.stringify(bodyOf(next));
  });
}
