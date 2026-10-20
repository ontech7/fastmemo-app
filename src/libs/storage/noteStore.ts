import { noteRev } from "@/libs/cloud/revision";

import type { Note, NotesState } from "@/types";

/*
 * The notes slice, stored one value per note (ADR-018). redux-persist hands over the whole slice on every change
 * (`serialize: false`); only the notes whose object changed are written, then a small "state" value with everything
 * else and the list of entries. Rewriting all notes on every save took 100-300ms at 2.5MB (LL-031).
 *
 * - Entries: every live note (`n:`), trashed note (`t:`) and note waiting in the outbox (`o:`), as JSON.
 * - The state value is written after the entries it lists, and entries it no longer lists are removed after it: a
 *   crash at any point leaves a state value whose entries all exist (the old ones or the new ones). Entries nothing
 *   lists are leftovers of such a crash, removed on the next launch.
 * - An entry that can't be read is taken from the spare a write left, then from the notes as stored before this store
 *   (kept as they were at the migration); only then is it given up, and reported. A read that fails (I/O, not a broken
 *   value) fails the whole read: the notes are then not written that session (LL-039). So does a state value in a
 *   format this version doesn't know (written by a newer one).
 * - Migration: with no state value yet, the notes come from the previous single value (redux-persist's layout), and
 *   the first write stores them here. That value is left untouched. Where the backend can tell it was rewritten since
 *   (an older version running again after a rollback, or the legacy fold finishing late), its notes are folded in:
 *   the ones missing here are added, and newer versions of ones in the same list replace them. Entries without a
 *   state value (a first write cut short, or a lost state value) are merged with the legacy notes the same way.
 */

type MaybePromise<T> = T | Promise<T>;

export interface NoteStoreBackend {
  /** The value, or the spare an interrupted write left in its place; `undefined` if there's neither. Throws if it can't be read. */
  read(name: string): MaybePromise<string | undefined>;
  /** The spare an interrupted write left (only where a write isn't atomic). */
  spare(name: string): MaybePromise<string | undefined>;
  /** Replaces the value: a crash leaves the old value or the new one (or its spare), never a mix. */
  write(name: string, value: string): MaybePromise<void>;
  /** Removes the value and its spare. */
  remove(name: string): MaybePromise<void>;
  /** Moves an unreadable value out of the way, kept for recovery. */
  setAside(name: string): MaybePromise<void>;
  /** Every stored name (a value or a spare). */
  list(): MaybePromise<string[]>;
  /** The notes as stored before this store: redux-persist's single value. */
  readLegacy(): MaybePromise<string | undefined>;
  /** Changes when that value is rewritten; `null` where it can't be told cheaply (then it's read only to migrate). */
  legacyStamp(): MaybePromise<string | null>;
}

export interface NoteStoreOptions {
  /** A recovered or given-up entry, a broken state value: things to look into, never thrown. */
  report(message: string, detail?: unknown): void;
  /** The notes read aren't in their stored order (some were added from the legacy value, or the order was lost). */
  onSortNeeded?(): void;
}

/** What redux-persist stores: the slice and its `_persist`. */
export type PersistedNotes = Partial<NotesState> & { _persist?: unknown } & Record<string, unknown>;

const STATE = "state";
const FORMAT = 1;

const LISTS = [
  ["items", "n"],
  ["temporaryItems", "t"],
] as const;

interface Head {
  format: number;
  /** Entry names, in order. */
  items: string[];
  temporaryItems: string[];
  /** Ids of the notes in the outbox (`cloud.items.add`), each stored under `o:<id>`. */
  outbox: string[];
  /** The slice without the notes. */
  rest: Record<string, unknown>;
  /** The legacy value's stamp when it was last looked at (see `legacyStamp`). */
  legacy: string | null;
}

const outboxName = (id: string) => `o:${id}`;

const isEntryName = (name: string) => /^[nto]:/.test(name);

/** The note id an entry name stands for (`n:<id>`, or `n:<id>#2` for a second note with that id). */
const idOf = (name: string) => name.slice(2).replace(/#\d+$/, "");

/** Only a syntax error means a broken value: anything else (out of memory) is a failed read. */
const parse = (value: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false };
    throw error;
  }
};

/** redux-persist's layout: every top-level key holds its value as JSON. */
export const parseLegacy = (raw: string): PersistedNotes =>
  Object.fromEntries(Object.entries(JSON.parse(raw) as Record<string, string>).map(([key, value]) => [key, JSON.parse(value)]));

/** The entries and the state value of a slice. */
const encode = (state: PersistedNotes, legacy: string | null) => {
  const entries = new Map<string, unknown>();
  const head: Head = { format: FORMAT, items: [], temporaryItems: [], outbox: [], rest: {}, legacy };

  for (const [key, prefix] of LISTS) {
    for (const note of (state[key] as Note[] | undefined) ?? []) {
      // Two notes with the same id (it shouldn't happen) each keep their own entry.
      const base = `${prefix}:${note?.id ?? ""}`;
      let name = base;
      for (let copy = 2; entries.has(name); copy++) name = `${base}#${copy}`;
      entries.set(name, note);
      head[key].push(name);
    }
  }

  const { items: _items, temporaryItems: _trash, ...rest } = state;
  const cloud = state.cloud;
  if (cloud?.items?.add) {
    for (const [id, note] of Object.entries(cloud.items.add)) {
      entries.set(outboxName(id), note);
      head.outbox.push(id);
    }
    rest.cloud = { ...cloud, items: { ...cloud.items, add: {} } };
  }
  head.rest = rest;

  return { entries, head: JSON.stringify(head) };
};

/** Folds the legacy notes into `state`: adds the ones it lacks, and newer versions of ones in the same list. */
const foldLegacy = (state: PersistedNotes, legacy: PersistedNotes): number => {
  const present = new Set(LISTS.flatMap(([key]) => ((state[key] as Note[] | undefined) ?? []).map((note) => note?.id)));
  const purged = (state.purged ?? {}) as Record<string, number>;
  let added = 0;

  for (const [key] of LISTS) {
    const legacyNotes = ((legacy[key] as Note[] | undefined) ?? []).filter((note) => typeof note?.id === "string");
    const legacyById = new Map(legacyNotes.map((note) => [note.id, note]));
    const merged = ((state[key] as Note[] | undefined) ?? []).map((note) => {
      const other = note && legacyById.get(note.id);
      return other && noteRev(other) > noteRev(note) ? other : note;
    });
    // Not brought back: a note deleted for good here since (unless its legacy copy changed after that).
    const missing = legacyNotes.filter(
      (note) => !present.has(note.id) && !(purged[note.id] !== undefined && purged[note.id] >= noteRev(note))
    );
    added += missing.length;
    state[key] = [...merged, ...missing];
  }
  return added;
};

export function createNoteStore(backend: NoteStoreBackend, options: NoteStoreOptions) {
  /** Name -> the object last written there (or read from there). Only entries whose object changed are written. */
  const written = new Map<string, unknown>();
  /** The state value as stored (`undefined`: to be written). */
  let writtenHead: string | undefined;
  /** The legacy value's stamp, recorded in the state value. */
  let legacyStamp: string | null = null;

  let queue: Promise<void> = Promise.resolve();
  let latestWrite = 0;

  /** Runs one operation at a time. */
  const enqueue = (op: () => Promise<void>) => {
    const run = queue.catch(() => {}).then(op);
    queue = run;
    return run;
  };

  let legacyCache: Promise<PersistedNotes | undefined> | undefined;
  /** The legacy notes, read once per launch, only when needed (migration, recovery, a fold). */
  const legacyNotes = () =>
    (legacyCache ??= Promise.resolve(backend.readLegacy()).then((raw) => {
      if (raw === undefined || raw === null) return undefined;
      try {
        return parseLegacy(raw);
      } catch (error) {
        if (error instanceof SyntaxError) {
          options.report("noteStore: the legacy notes are unreadable", error);
          return undefined;
        }
        throw error;
      }
    }));

  /** Reads and parses a value, falling back to its spare; `undefined` if neither is readable. */
  const readValue = async (name: string): Promise<{ value: unknown } | undefined> => {
    const raw = await backend.read(name);
    if (raw !== undefined) {
      const parsed = parse(raw);
      if (parsed.ok) return { value: parsed.value };
    }
    const spare = await backend.spare(name);
    if (spare !== undefined) {
      const parsed = parse(spare);
      if (parsed.ok) return { value: parsed.value };
    }
    if (raw !== undefined) await backend.setAside(name);
    return undefined;
  };

  /** A note this store lost, from the legacy notes (any list): an older version beats none. */
  const fromLegacy = async (id: string): Promise<Note | undefined> => {
    const legacy = await legacyNotes();
    for (const [key] of LISTS) {
      const note = ((legacy?.[key] as Note[] | undefined) ?? []).find((candidate) => candidate?.id === id);
      if (note) return note;
    }
    return undefined;
  };

  /** A head for the entries stored without a readable state value. */
  const headOfEntries = (names: string[]): Head => {
    const ofPrefix = (prefix: string) => names.filter((name) => name.startsWith(`${prefix}:`));
    return {
      format: FORMAT,
      items: ofPrefix("n"),
      temporaryItems: ofPrefix("t"),
      outbox: ofPrefix("o").map((name) => name.slice(2)),
      rest: {},
      legacy: null,
    };
  };

  const isHead = (value: unknown): value is Head =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as Head).format === "number" &&
    Array.isArray((value as Head).items) &&
    Array.isArray((value as Head).temporaryItems) &&
    Array.isArray((value as Head).outbox);

  const read = async (): Promise<PersistedNotes | undefined> => {
    const stored = await readValue(STATE);
    let head: Head;
    /** Entries without a usable state value: rebuilt, merged with the legacy notes, and written again in full. */
    let rebuilt = false;
    /** Something was lost or replaced: the state value is written again, and nothing is cleaned up. */
    let recovered = false;

    if (stored !== undefined && isHead(stored.value)) {
      if (stored.value.format !== FORMAT) {
        // Written by a newer version: don't guess, and don't write over it (LL-039).
        throw new Error(`noteStore: unknown format ${stored.value.format}`);
      }
      head = stored.value;
    } else {
      const names = [...new Set((await backend.list()).filter(isEntryName))];
      if (stored === undefined && names.length === 0) {
        // Not migrated yet: the notes as stored before (written here on the first write).
        legacyStamp = await backend.legacyStamp();
        const legacy = await legacyNotes();
        legacyCache = undefined;
        return legacy;
      }
      options.report(
        stored === undefined
          ? "noteStore: entries without a state value, merging them with the legacy notes"
          : "noteStore: the state value is unreadable, rebuilding it"
      );
      head = headOfEntries(names);
      rebuilt = true;
      recovered = true;
    }

    /** Reads an entry; a lost note comes from the legacy notes, or is given up. */
    const entry = async (name: string): Promise<unknown> => {
      const value = await readValue(name);
      if (value !== undefined) {
        written.set(name, value.value);
        return value.value;
      }
      recovered = true;
      if (name.startsWith("o:")) {
        // The note itself is stored: the next full sync uploads its change if the cloud lacks it.
        options.report("noteStore: an outbox entry was lost", { name });
        return undefined;
      }
      const note = await fromLegacy(idOf(name));
      options.report(note ? "noteStore: a lost note was restored from the legacy notes" : "noteStore: a note was lost", {
        name,
      });
      return note;
    };

    const state: PersistedNotes = { ...head.rest };
    const [items, trash, outbox] = await Promise.all(
      [head.items, head.temporaryItems, head.outbox.map(outboxName)].map((names) => Promise.all(names.map(entry)))
    );
    state.items = items.filter(Boolean) as Note[];
    state.temporaryItems = trash.filter(Boolean) as Note[];
    if (head.outbox.length > 0 || state.cloud) {
      const add: Record<string, Note> = {};
      head.outbox.forEach((id, i) => {
        if (outbox[i]) add[id] = outbox[i] as Note;
      });
      const cloud = (state.cloud ?? { items: { delete: {}, detach: {} } }) as NotesState["cloud"];
      state.cloud = { ...cloud, items: { ...cloud.items, add } };
    }

    // What's stored now, before anything is folded in.
    if (!recovered) writtenHead = encode(state, head.legacy).head;
    legacyStamp = head.legacy;

    const stamp = rebuilt ? null : await backend.legacyStamp();
    if (rebuilt || (stamp !== null && stamp !== head.legacy)) {
      const legacy = await legacyNotes();
      if (stamp !== null) legacyStamp = stamp;
      if (legacy) {
        const added = foldLegacy(state, legacy);
        if (rebuilt) {
          // The settings, the deletions waiting to go out: the legacy ones beat none.
          for (const [key, value] of Object.entries(legacy)) {
            if (key === "cloud") {
              const cloud = value as NotesState["cloud"];
              const add = (state.cloud as NotesState["cloud"] | undefined)?.items.add ?? {};
              state.cloud = { ...cloud, items: { ...cloud.items, add } };
            } else if (!(key in state)) {
              state[key] = value;
            }
          }
        }
        if (added > 0) options.onSortNeeded?.();
      }
    }
    if (rebuilt) options.onSortNeeded?.();
    legacyCache = undefined;

    if (!recovered) {
      // Leftovers of a write cut short before its cleanup: every entry the state value lists was just read.
      enqueue(async () => {
        for (const name of await backend.list()) {
          if (isEntryName(name) && !written.has(name)) await backend.remove(name);
        }
      }).catch((error) => options.report("noteStore: cleanup failed", error));
    }
    return state;
  };

  const write = async (state: PersistedNotes) => {
    const { entries, head } = encode(state, legacyStamp);

    for (const [name, value] of entries) {
      if (written.get(name) === value) continue;
      await backend.write(name, JSON.stringify(value));
      written.set(name, value);
    }
    if (head !== writtenHead) {
      await backend.write(STATE, head);
      writtenHead = head;
    }
    for (const name of [...written.keys()]) {
      if (entries.has(name)) continue;
      await backend.remove(name);
      written.delete(name);
    }
  };

  /** redux-persist's storage interface, for the notes key. */
  return {
    getItem: (_key: string): Promise<PersistedNotes | undefined> => read(),
    setItem: (_key: string, value: PersistedNotes): Promise<void> => {
      // redux-persist keeps updating the object it passes: take the slice as it is now. Every write carries the whole
      // slice, so one that a newer one superseded while it waited is skipped.
      const state = { ...value };
      const id = ++latestWrite;
      return enqueue(() => (id === latestWrite ? write(state) : Promise.resolve()));
    },
    removeItem: (_key: string): Promise<void> =>
      enqueue(async () => {
        for (const name of await backend.list()) await backend.remove(name);
        written.clear();
        writtenHead = undefined;
      }),
  };
}
