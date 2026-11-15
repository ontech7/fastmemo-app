import type { Note } from "@/types";

/*
 * What should ring (spec D.5): pure, so the phone's scheduler (Task 39) only carries out a plan. A protected or hidden
 * note rings with no title: its title is never shown in a notification or stored with one.
 */

export interface Scheduled {
  noteId: string;
  at: number;
  /** Protected or hidden: its title is never shown or stored. */
  private: boolean;
  title: string;
}

export interface ReminderPlan {
  schedule: Scheduled[];
  /** Note ids. */
  cancel: string[];
}

type ReminderNote = Pick<Note, "id" | "title" | "remindAt" | "locked" | "hidden">;

export function isUpcoming(note: { remindAt?: number }, now: number): boolean {
  return typeof note.remindAt === "number" && note.remindAt > now;
}

const scheduledFor = (note: ReminderNote): Scheduled => {
  const isPrivate = note.locked || note.hidden;
  return { noteId: note.id, at: note.remindAt as number, private: isPrivate, title: isPrivate ? "" : note.title };
};

const same = (a: Scheduled, b: Scheduled) => a.at === b.at && a.private === b.private && (a.private || a.title === b.title);

/** `live`: the notes that aren't in the trash. `scheduled`: what this phone has scheduled now. */
export function planReminders(live: readonly ReminderNote[], scheduled: readonly Scheduled[], now: number): ReminderPlan {
  const wanted = new Map<string, Scheduled>();
  for (const note of live) if (isUpcoming(note, now)) wanted.set(note.id, scheduledFor(note));

  const cancel: string[] = [];
  const kept = new Set<string>();
  for (const item of scheduled) {
    if (cancel.includes(item.noteId) || kept.has(item.noteId)) continue;
    const next = wanted.get(item.noteId);
    if (next && same(next, item)) kept.add(item.noteId);
    else cancel.push(item.noteId);
  }

  const schedule = [...wanted.values()].filter((item) => !kept.has(item.noteId));
  return { schedule, cancel };
}

/** The note with this reminder, or with none: the key is then absent, never undefined or null. */
export function withReminder<T extends Note>(note: T, at: number | null): T {
  if (at === null) {
    const { remindAt: _removed, ...rest } = note;
    return rest as T;
  }
  return { ...note, remindAt: at };
}
