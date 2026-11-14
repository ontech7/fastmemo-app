import { hashText } from "@/utils/hash";
import type { Note } from "@/types";

import {
  bodyOf,
  shouldKeep,
  toDropForNote,
  toDropForTotal,
  type VersionBody,
  type VersionMeta,
  type VersionReason,
} from "./limits";

/*
 * The versions of the notes over a backend of named values (spec B.9). Two kinds of value: `i:<noteId>`, the note's
 * versions (`VersionMeta[]`, newest first), and `v:<noteId>:<versionId>`, one version's body, both as JSON. Every call
 * waits its turn behind the ones asked before it: two keeps at the same instant are both stored, and a note dropped
 * while one of its versions is written loses that one too.
 */

export interface HistoryBackend {
  list(): Promise<string[]>;
  /** null when there is no such value; throws when it can't be read. */
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
  clear(): Promise<void>;
}

export interface History {
  /** true when a version was stored. Never throws. */
  keep(note: Note, reason: VersionReason): Promise<boolean>;
  /** Newest first. */
  list(noteId: string): Promise<VersionMeta[]>;
  read(noteId: string, versionId: string): Promise<VersionBody | null>;
  dropNote(noteId: string): Promise<void>;
  /** Drops what belongs to no note of the set, bodies no index names, and whatever is over the total limit. */
  sweep(noteIds: ReadonlySet<string>): Promise<void>;
  wipe(): Promise<void>;
}

const indexName = (noteId: string) => `i:${noteId}`;
const bodyName = (noteId: string, versionId: string) => `v:${noteId}:${versionId}`;

/** A value's name taken apart; null for a name that is neither an index nor a body. */
function parseName(name: string): { kind: "index"; noteId: string } | { kind: "body"; noteId: string; id: string } | null {
  if (name.startsWith("i:")) return { kind: "index", noteId: name.slice(2) };
  if (!name.startsWith("v:")) return null;
  const rest = name.slice(2);
  const at = rest.lastIndexOf(":");
  if (at <= 0) return null;
  return { kind: "body", noteId: rest.slice(0, at), id: rest.slice(at + 1) };
}

class UnreadableIndex extends Error {}

export function createHistory(
  backend: HistoryBackend,
  now: () => number = Date.now,
  onError: (error: unknown) => void = () => {}
): History {
  let queue: Promise<unknown> = Promise.resolve();
  const run = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => {});
    return next;
  };

  /** The note's versions; [] when there are none. Throws when the index can't be read: it is then never written. */
  const readIndex = async (noteId: string): Promise<VersionMeta[]> => {
    const raw = await backend.read(indexName(noteId));
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as VersionMeta[];
    } catch {
      // below
    }
    throw new UnreadableIndex(`history index of a note can't be read`);
  };

  const writeIndex = (noteId: string, kept: readonly VersionMeta[]) =>
    kept.length ? backend.write(indexName(noteId), JSON.stringify(kept)) : backend.remove(indexName(noteId));

  /** The time in base 36, and a counter when another version has the same. */
  const newId = (at: number, kept: readonly VersionMeta[]) => {
    const base = at.toString(36);
    let id = base;
    for (let n = 1; kept.some((v) => v.id === id); n++) id = `${base}-${n}`;
    return id;
  };

  /** Drops versions from a note's index (written first), then their bodies. */
  const drop = async (noteId: string, kept: readonly VersionMeta[], ids: readonly string[]) => {
    if (!ids.length) return kept;
    const gone = new Set(ids);
    const left = kept.filter((v) => !gone.has(v.id));
    await writeIndex(noteId, left);
    for (const id of ids) await backend.remove(bodyName(noteId, id));
    return left;
  };

  return {
    keep: (note, reason) =>
      run(async () => {
        let kept: VersionMeta[];
        let next: VersionMeta[];
        try {
          const json = JSON.stringify(bodyOf(note));
          const hash = hashText(json);
          kept = await readIndex(note.id);
          const at = now();
          if (!shouldKeep(kept, { at, reason, hash })) return false;
          const meta: VersionMeta = { id: newId(at, kept), noteId: note.id, at, reason, size: json.length, hash };
          await backend.write(bodyName(note.id, meta.id), json);
          next = [meta, ...kept];
          await writeIndex(note.id, next);
        } catch (error) {
          onError(error);
          return false;
        }
        try {
          await drop(note.id, next, toDropForNote(next));
        } catch (error) {
          onError(error);
        }
        return true;
      }),

    list: (noteId) =>
      run(async () => {
        try {
          return await readIndex(noteId);
        } catch (error) {
          onError(error);
          return [];
        }
      }),

    read: (noteId, versionId) =>
      run(async () => {
        try {
          const raw = await backend.read(bodyName(noteId, versionId));
          return raw === null ? null : (JSON.parse(raw) as VersionBody);
        } catch (error) {
          onError(error);
          return null;
        }
      }),

    dropNote: (noteId) =>
      run(async () => {
        try {
          await backend.remove(indexName(noteId));
          for (const name of await backend.list()) {
            const parsed = parseName(name);
            if (parsed?.kind === "body" && parsed.noteId === noteId) await backend.remove(name);
          }
        } catch (error) {
          onError(error);
        }
      }),

    sweep: (noteIds) =>
      run(async () => {
        try {
          const indexes = new Set<string>();
          const bodies = new Map<string, Set<string>>();
          for (const name of await backend.list()) {
            const parsed = parseName(name);
            if (parsed?.kind === "index") indexes.add(parsed.noteId);
            else if (parsed?.kind === "body") {
              if (!bodies.has(parsed.noteId)) bodies.set(parsed.noteId, new Set());
              bodies.get(parsed.noteId)!.add(parsed.id);
            }
          }
          const all: VersionMeta[] = [];
          const live = new Map<string, VersionMeta[]>();
          for (const noteId of new Set([...indexes, ...bodies.keys()])) {
            const ids = bodies.get(noteId) ?? new Set<string>();
            if (!noteIds.has(noteId)) {
              // a note that is gone: everything of it
              if (indexes.has(noteId)) await backend.remove(indexName(noteId));
              for (const id of ids) await backend.remove(bodyName(noteId, id));
              continue;
            }
            let kept: VersionMeta[];
            try {
              kept = await readIndex(noteId);
            } catch (error) {
              // left as it is
              onError(error);
              continue;
            }
            const named = new Set(kept.map((v) => v.id));
            const present = kept.filter((v) => ids.has(v.id));
            if (present.length !== kept.length) await writeIndex(noteId, present);
            for (const id of ids) if (!named.has(id)) await backend.remove(bodyName(noteId, id));
            live.set(noteId, present);
            all.push(...present);
          }
          const over = toDropForTotal(all);
          const byNote = new Map<string, string[]>();
          for (const v of over) byNote.set(v.noteId, [...(byNote.get(v.noteId) ?? []), v.id]);
          for (const [noteId, ids] of byNote) await drop(noteId, live.get(noteId) ?? [], ids);
        } catch (error) {
          onError(error);
        }
      }),

    wipe: () =>
      run(async () => {
        try {
          await backend.clear();
        } catch (error) {
          onError(error);
        }
      }),
  };
}
