import { noteRev } from "@/libs/cloud/revision";

import type { Note, NotesState } from "@/types";

/*
 * The notes slice, stored one value per note (ADR-018). redux-persist hands over the whole slice on every change
 * (`serialize: false`); only the notes whose object changed are written, then a small "state" value with everything
 * else and the list of entries. Rewriting all notes on every save took 100-300ms at 2.5MB (LL-031).
 *
 * - Entries: every live note (`n:`), trashed note (`t:`) and note waiting in the outbox (`o:`), as JSON.
 * - A write stores the outbox entries, then the notes, then the state value, then removes the entries it no longer
 *   lists: a crash at any point leaves a state value whose entries all exist (the old ones or the new ones). Entries
 *   nothing lists are leftovers of such a crash, removed on the next launch, except the outbox entry of a listed note
 *   with a change the cloud doesn't have: the crash came before the state value listed it, and it's taken back.
 * - An entry that can't be read is taken from the spare a write left, then from the notes as stored before this store
 *   (kept as they were at the migration); only then is it given up, and reported. A read that fails (I/O, not a broken
 *   value) fails the whole read: the notes are then not written that session (LL-039). So does a state value in a
 *   format this version doesn't know (written by a newer one).
 * - Migration: with no state value, no entries and no marker, the notes come from the previous single value
 *   (redux-persist's layout). The first write stores them here, then the state value, then the marker: the legacy notes
 *   the store has taken into account, with their revisions (made again from the legacy value if it's lost). The single
 *   value is kept for a rollback (an older version, or an older tab, reads and writes it). When it changes, its notes
 *   are folded in: newer versions of notes in the same list replace them, and a missing note comes back only if the
 *   marker doesn't hold it at that revision (deleted here since: it stays deleted); the marker then takes them in. A
 *   lost state value is rebuilt from the entries, folded the same way. After KEEP_LEGACY_MS the single value and the
 *   other copies (backups, values set aside) are removed, after a write stored what was folded; "Wipe data" removes
 *   them at once.
 * - Where other writers can share the storage (browser tabs), reads and writes run one at a time across them. A write
 *   that finds a state value it didn't write rewrites every entry that value doesn't list, or, with nothing of its own
 *   to store, doesn't write at all (it would put an older view back).
 */

type MaybePromise<T> = T | Promise<T>;

export interface NoteStoreBackend {
  /** The value; `undefined` if there's none. Throws if it can't be read. */
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
  /** Removes every copy of the notes kept outside the store: that value, older backups, the values set aside. */
  removeCopies(): MaybePromise<void>;
  /** Runs `task` while no other writer of the same storage runs one (browser tabs); absent where there's one writer. */
  exclusive?<T>(task: () => Promise<T>): Promise<T>;
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
const MIGRATED = "migrated";
const FORMAT = 1;
/** How long the legacy value is kept after the migration, for a rollback. */
const KEEP_LEGACY_MS = 14 * 24 * 60 * 60 * 1000;
/** Values read at a time (on a Pixel 10 Pro, 400 notes: 70 ms at 32, 125 ms at 8, 0.8-1 s one by one). */
const READS = 32;
/** Values written at a time. */
const WRITES = 8;

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
  /** When the notes were migrated, while the legacy value is kept. */
  migratedAt?: number;
}

/** Written by the migration, never changed: the notes it took from the legacy value, with their revisions. */
interface Marker {
  at: number;
  notes: [string, number][];
}

const outboxName = (id: string) => `o:${id}`;

const isEntryName = (name: string) => /^[nto]:/.test(name);

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

const isHead = (value: unknown): value is Head =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Head).format === "number" &&
  Array.isArray((value as Head).items) &&
  Array.isArray((value as Head).temporaryItems) &&
  Array.isArray((value as Head).outbox);

const notesOf = (state: PersistedNotes | undefined, key: (typeof LISTS)[number][0]) =>
  ((state?.[key] as Note[] | undefined) ?? []).filter((note) => typeof note?.id === "string");

/** A note with a change the cloud doesn't have yet (what an outbox entry is for). */
const hasUnsyncedChange = (note: Note | undefined) =>
  note !== undefined && !note.local && !(note.syncedRev !== undefined && note.syncedRev >= noteRev(note));

/** `task` over `items`, `limit` at a time, results in order. After a failure nothing new starts, and it rejects with it. */
const mapLimited = async <T, R>(items: readonly T[], limit: number, task: (item: T) => MaybePromise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: { error: unknown } | undefined;
  const worker = async () => {
    while (failure === undefined && next < items.length) {
      const i = next++;
      try {
        results[i] = await task(items[i]);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure.error;
  return results;
};

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {}); // nobody waiting on a failed write isn't an error: it's reported to its own caller
  return { promise, resolve, reject };
};

/** The entries and the state value of a slice. */
const encode = (state: PersistedNotes, legacy: string | null, migratedAt: number | undefined) => {
  const entries = new Map<string, unknown>();
  const head: Head = { format: FORMAT, items: [], temporaryItems: [], outbox: [], rest: {}, legacy, migratedAt };

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

/** The names a stored state value lists, or `null` if it isn't one. */
const listedBy = (raw: string | undefined): Set<string> | null => {
  const parsed = raw === undefined ? undefined : parse(raw);
  if (!parsed?.ok || !isHead(parsed.value)) return null;
  const head = parsed.value;
  return new Set([...head.items, ...head.temporaryItems, ...head.outbox.map(outboxName)]);
};

/** The legacy notes taken into account: those of `taken`, and the legacy value's (the highest revision of an id). */
const takenFrom = (legacy: PersistedNotes | undefined, taken?: Map<string, number>): [string, number][] => {
  const revs = new Map(taken);
  for (const [key] of LISTS) {
    for (const note of notesOf(legacy, key)) revs.set(note.id, Math.max(noteRev(note), revs.get(note.id) ?? -Infinity));
  }
  return [...revs];
};

/**
 * Folds the legacy notes into `state`: newer versions of notes in the same list replace them, and a missing note is
 * added unless it was deleted here since. That's known from `taken` (the notes the migration took: one it took at
 * that revision was deleted here) and from the tombstones. Without `taken`, every missing note is added.
 */
const foldLegacy = (state: PersistedNotes, legacy: PersistedNotes, taken?: Map<string, number>): number => {
  const present = new Set(LISTS.flatMap(([key]) => ((state[key] as Note[] | undefined) ?? []).map((note) => note?.id)));
  const purged = new Map(Object.entries((state.purged ?? {}) as Record<string, number>));
  let added = 0;

  for (const [key] of LISTS) {
    const legacyNotes = notesOf(legacy, key);
    const legacyById = new Map(legacyNotes.map((note) => [note.id, note]));
    const merged = ((state[key] as Note[] | undefined) ?? []).map((note) => {
      const other = note && legacyById.get(note.id);
      return other && noteRev(other) > noteRev(note) ? other : note;
    });
    const missing = legacyNotes.filter((note) => {
      if (present.has(note.id)) return false;
      const rev = noteRev(note);
      const deletedAt = purged.get(note.id);
      if (deletedAt !== undefined && deletedAt >= rev) return false;
      const takenAt = taken?.get(note.id);
      return takenAt === undefined || rev > takenAt;
    });
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
  /** When the notes were migrated, while the legacy value is kept (recorded in the state value). */
  let migratedAt: number | undefined;
  /** A marker to store, after the next state value. */
  let pendingMarker: Marker | undefined;
  /** The rollback window is over: the next write removes the notes' other copies, once its state value is stored. */
  let expiring = false;

  let queue: Promise<unknown> = Promise.resolve();
  let latestWrite = 0;
  /** Settles as the next write to run does: what a write skipped for a newer one waits for. */
  let nextWrite = deferred();

  /** Runs one operation at a time. */
  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.catch(() => {}).then(op);
    queue = run;
    return run;
  };

  const exclusive = <T>(task: () => Promise<T>): Promise<T> => (backend.exclusive ? backend.exclusive(task) : task());

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

  /**
   * Reads and parses a value, falling back to its spare (`spare`: the value came from it, and is to be written again, into
   * place); `undefined` if neither is readable.
   */
  const readValue = async (name: string): Promise<{ value: unknown; spare: boolean } | undefined> => {
    const raw = await backend.read(name);
    if (raw !== undefined) {
      const parsed = parse(raw);
      if (parsed.ok) return { value: parsed.value, spare: false };
    }
    const spare = await backend.spare(name);
    if (spare !== undefined) {
      const parsed = parse(spare);
      if (parsed.ok) return { value: parsed.value, spare: true };
    }
    if (raw !== undefined) await backend.setAside(name);
    return undefined;
  };

  /**
   * The migration's marker: `null` if there's none (not migrated). An unreadable one has no `taken`; `whole` is false for
   * one to be written again (unreadable, or read from its spare).
   */
  const readMarker = async (): Promise<{ taken?: Map<string, number>; at?: number; whole: boolean } | null> => {
    if ((await backend.read(MIGRATED)) === undefined && (await backend.spare(MIGRATED)) === undefined) return null;
    const read = await readValue(MIGRATED);
    const marker = read?.value as Marker | undefined;
    if (typeof marker?.at !== "number" || !Array.isArray(marker.notes)) {
      options.report("noteStore: the migration marker is unreadable");
      return { whole: false };
    }
    return { taken: new Map(marker.notes), at: marker.at, whole: !read?.spare };
  };

  /** A note this store lost, from the legacy notes (any list): an older version beats none. */
  const fromLegacy = async (name: string): Promise<Note | undefined> => {
    const legacy = await legacyNotes();
    const id = name.slice(2);
    // `n:<id>#2` is a second note with that id, or one whose id ends that way: the exact id first.
    for (const candidate of [id, id.replace(/#\d+$/, "")]) {
      for (const [key] of LISTS) {
        const note = notesOf(legacy, key).find((other) => other.id === candidate);
        if (note) return note;
      }
    }
    return undefined;
  };

  const read = async (): Promise<PersistedNotes | undefined> => {
    const stored = await readValue(STATE);
    const format = (stored?.value as Partial<Head> | null | undefined)?.format;
    if (typeof format === "number" && format !== FORMAT) {
      // Written by a newer version: don't guess, and don't write over it (LL-039).
      throw new Error(`noteStore: unknown format ${format}`);
    }

    const entryNames = [...new Set((await backend.list()).filter(isEntryName))];
    let head: Head;
    /** No usable state value: rebuilt from the entries and the legacy notes, and written again in full. */
    let rebuilt = false;
    /** Something was lost or replaced: the state value is written again, and nothing is cleaned up. */
    let recovered = false;
    let marker: Awaited<ReturnType<typeof readMarker>> | undefined;
    const theMarker = async () => (marker === undefined ? (marker = await readMarker()) : marker);

    if (stored !== undefined && isHead(stored.value)) {
      head = stored.value;
    } else {
      if (stored === undefined && entryNames.length === 0 && (await theMarker()) === null) {
        // Not migrated yet: the notes as stored before (written here on the first write).
        legacyStamp = await backend.legacyStamp();
        const legacy = await legacyNotes();
        legacyCache = undefined;
        migratedAt = Date.now();
        pendingMarker = { at: migratedAt, notes: takenFrom(legacy) };
        expiring = false;
        return legacy;
      }
      options.report(
        stored === undefined
          ? "noteStore: no state value, rebuilding it from the entries and the legacy notes"
          : "noteStore: the state value is unreadable, rebuilding it"
      );
      head = { format: FORMAT, items: [], temporaryItems: [], outbox: [], rest: {}, legacy: null };
      for (const name of entryNames) {
        if (name.startsWith("n:")) head.items.push(name);
        else if (name.startsWith("t:")) head.temporaryItems.push(name);
      }
      rebuilt = true;
      recovered = true;
    }

    const lost: string[] = [];
    const restored: string[] = [];
    /** Reads an entry; a lost note comes from the legacy notes, or is given up. */
    const entry = async (name: string): Promise<unknown> => {
      const value = await readValue(name);
      if (value !== undefined) {
        // From its spare: not marked as written, so the next write puts it in place.
        if (!value.spare) written.set(name, value.value);
        return value.value;
      }
      recovered = true;
      // A lost outbox entry: the note itself is stored, and the next full sync uploads its change if the cloud lacks it.
      const note = name.startsWith("o:") ? undefined : await fromLegacy(name);
      (note ? restored : lost).push(name);
      return note;
    };

    const state: PersistedNotes = { ...head.rest };
    const notes = await mapLimited([...head.items, ...head.temporaryItems], READS, entry);
    state.items = notes.slice(0, head.items.length).filter(Boolean) as Note[];
    state.temporaryItems = notes.slice(head.items.length).filter(Boolean) as Note[];

    const setOutbox = (ids: string[], values: unknown[]) => {
      const cloud = (state.cloud ?? { items: { delete: {}, detach: {} } }) as NotesState["cloud"];
      const add = { ...cloud.items.add };
      ids.forEach((id, i) => {
        if (values[i]) add[id] = values[i] as Note;
      });
      state.cloud = { ...cloud, items: { ...cloud.items, add } };
    };
    const listedOutbox = rebuilt ? [] : head.outbox;
    if (listedOutbox.length > 0 || state.cloud) {
      setOutbox(listedOutbox, await mapLimited(listedOutbox.map(outboxName), READS, entry));
    }

    // What's stored now, before anything is taken back or folded in.
    if (!recovered && !stored?.spare) writtenHead = encode(state, head.legacy, head.migratedAt).head;
    legacyStamp = head.legacy;
    migratedAt = head.migratedAt;

    // Outbox entries nothing lists, of notes with a change the cloud lacks: a crash came before the state value listed
    // them. (After a rebuild, that's every outbox entry worth keeping.)
    const byId = new Map([...state.items, ...state.temporaryItems].map((note) => [note.id, note]));
    const listed = new Set(listedOutbox);
    const unlisted = entryNames
      .filter((name) => name.startsWith("o:") && !listed.has(name.slice(2)))
      .map((name) => name.slice(2))
      .filter((id) => hasUnsyncedChange(byId.get(id)));
    if (unlisted.length > 0) setOutbox(unlisted, await mapLimited(unlisted.map(outboxName), READS, entry));

    if (rebuilt) {
      legacyStamp = await backend.legacyStamp();
      const legacy = await legacyNotes();
      const found = await theMarker();
      if (legacy) {
        // The settings and the tombstones (before the fold, which respects them): the legacy ones beat none. Not its
        // persist version: these notes are this version's, and taking them for an older one's would migrate them again.
        for (const [key, value] of Object.entries(legacy)) {
          if (key === "items" || key === "temporaryItems" || key === "_persist") continue;
          if (key === "cloud") {
            const legacyCloud = value as NotesState["cloud"];
            const add = (state.cloud as NotesState["cloud"] | undefined)?.items.add ?? {};
            // Once migrated, the legacy deletions went out long ago (or were superseded): only an unfinished migration's
            // queues are still current.
            state.cloud = found
              ? { items: { add, delete: {}, detach: {} } }
              : { ...legacyCloud, items: { ...legacyCloud.items, add: { ...legacyCloud.items.add, ...add } } };
          } else if (!(key in state)) {
            state[key] = value;
          }
        }
        foldLegacy(state, legacy, found?.taken);
      }
      // No marker: a migration cut short (the marker comes after the first state value), completed with this write.
      if (found === null) migratedAt = Date.now();
      else if (legacy) migratedAt = found.at ?? Date.now();
      if (legacy || found === null) pendingMarker = { at: migratedAt ?? Date.now(), notes: takenFrom(legacy, found?.taken) };
      options.onSortNeeded?.();
    } else {
      const stamp = await backend.legacyStamp();
      const changed = stamp !== null && stamp !== head.legacy;
      // While the legacy value is kept, a lost or unreadable marker (a crash before or while it was written) is made again
      // from it: unchanged, it holds the notes the migration took.
      const found = changed || migratedAt !== undefined ? await theMarker() : undefined;
      if (changed) {
        legacyStamp = stamp;
        const legacy = await legacyNotes();
        if (legacy) {
          if (foldLegacy(state, legacy, found?.taken) > 0) options.onSortNeeded?.();
          pendingMarker = { at: found?.at ?? migratedAt ?? Date.now(), notes: takenFrom(legacy, found?.taken) };
        }
      } else if (migratedAt !== undefined && !found?.taken) {
        const legacy = await legacyNotes();
        if (legacy) pendingMarker = { at: found?.at ?? migratedAt, notes: takenFrom(legacy) };
      } else if (found?.taken && !found.whole) {
        pendingMarker = { at: found.at ?? Date.now(), notes: [...found.taken] };
      }
    }
    legacyCache = undefined;

    if (lost.length > 0 || restored.length > 0) {
      options.report(`noteStore: ${lost.length} entries lost, ${restored.length} restored from the legacy notes`, {
        lost,
        restored,
      });
    }

    if (!recovered) {
      // The rollback window is over: the other copies go with the next write (after it stored what was just folded).
      expiring = migratedAt !== undefined && Date.now() - migratedAt > KEEP_LEGACY_MS;
      // Leftovers of a write cut short before its cleanup (every entry the state value lists was just read).
      const leftovers = entryNames.filter((name) => !written.has(name));
      if (leftovers.length > 0) {
        enqueue(() =>
          exclusive(async () => {
            // Another writer (tab) stored a state value since: what it lists isn't known here, its next launch cleans up.
            if (backend.exclusive && (await backend.read(STATE)) !== writtenHead) return;
            await mapLimited(leftovers, WRITES, (name) => backend.remove(name));
          })
        ).catch((error) => options.report("noteStore: cleanup failed", error));
      }
    }
    return state;
  };

  const write = async (state: PersistedNotes) => {
    try {
      await writeState(state);
    } catch (error) {
      // What's stored is unknown now (and another tab may clean up what this write left unlisted): the next write
      // checks the stored state value, as a foreign one.
      writtenHead = undefined;
      throw error;
    }
  };

  const writeState = async (state: PersistedNotes) => {
    const { entries, head } = encode(state, legacyStamp, migratedAt);
    const own =
      head !== writtenHead ||
      [...entries].some(([name, value]) => written.get(name) !== value) ||
      [...written.keys()].some((name) => !entries.has(name));

    // Another writer stored a state value since (a tab with its own copy of the notes): an entry it doesn't list may
    // have been removed, whatever `written` says. Its own entries are left for the next launch to clean up.
    let foreign = false;
    let listed: Set<string> | null = null;
    if (backend.exclusive) {
      const stored = await backend.read(STATE);
      foreign = stored !== writtenHead;
      if (foreign) listed = listedBy(stored);
    }
    // With nothing of its own to store, a stale copy mustn't put its older view over the other writer's.
    if (foreign && !own) return;
    const changed = ([name, value]: [string, unknown]) =>
      written.get(name) !== value || (foreign && (listed === null || !listed.has(name)));
    const store = async ([name, value]: [string, unknown]) => {
      await backend.write(name, JSON.stringify(value));
      written.set(name, value);
    };

    const pending = [...entries].filter(changed);
    // The outbox entries first: a crash then leaves a changed note's entry waiting (taken back at launch), never a
    // changed note without it.
    await mapLimited(
      pending.filter(([name]) => name.startsWith("o:")),
      WRITES,
      store
    );
    await mapLimited(
      pending.filter(([name]) => !name.startsWith("o:")),
      WRITES,
      store
    );
    if (head !== writtenHead || foreign) {
      await backend.write(STATE, head);
      writtenHead = head;
    }
    // After the state value: a marker means the migration finished (a rebuild then drops the legacy deletion queues).
    if (pendingMarker) {
      await backend.write(MIGRATED, JSON.stringify(pendingMarker));
      pendingMarker = undefined;
    }
    await mapLimited(
      [...written.keys()].filter((name) => !entries.has(name)),
      WRITES,
      async (name) => {
        await backend.remove(name);
        written.delete(name);
      }
    );
    if (expiring) {
      await backend.removeCopies();
      expiring = false;
      legacyStamp = null;
      migratedAt = undefined;
      const after = encode(state, legacyStamp, migratedAt).head;
      await backend.write(STATE, after);
      writtenHead = after;
    }
  };

  /** redux-persist's storage interface for the notes key, and the wipe's cleanup. */
  return {
    getItem: (_key: string): Promise<PersistedNotes | undefined> => exclusive(read),
    setItem: (_key: string, value: PersistedNotes): Promise<void> => {
      // redux-persist keeps updating the object it passes: take the slice as it is now. Every write carries the whole
      // slice, so one that a newer one superseded while it waited is skipped. Its caller waits for that newer write
      // (outside the queue: it runs after this one), so a flush never resolves before the slice is stored.
      const state = { ...value };
      const id = ++latestWrite;
      return enqueue(async () => {
        if (id !== latestWrite) return { supersededBy: nextWrite.promise };
        const settle = nextWrite;
        nextWrite = deferred();
        try {
          await exclusive(() => write(state));
          settle.resolve();
        } catch (error) {
          settle.reject(error);
          throw error;
        }
        return {};
      }).then(({ supersededBy }) => supersededBy);
    },
    removeItem: (_key: string): Promise<void> =>
      enqueue(() =>
        exclusive(async () => {
          // The marker stays: the notes were migrated, the legacy value mustn't come back as if they weren't.
          await mapLimited(
            (await backend.list()).filter((name) => name !== MIGRATED),
            WRITES,
            (name) => backend.remove(name)
          );
          written.clear();
          writtenHead = undefined;
        })
      ),
    /** Removes the notes' copies outside the store (wiping the data): see `NoteStoreBackend.removeCopies`. */
    removeCopies: (): Promise<void> =>
      enqueue(() =>
        exclusive(async () => {
          await backend.removeCopies();
          legacyStamp = null;
          migratedAt = undefined;
          expiring = false;
        })
      ).catch((error) => options.report("noteStore: removing the notes' other copies failed", error)),
  };
}
