import { HELP_TOPICS } from "@/constants/help-topics";
import { noteRev } from "@/libs/cloud/revision";
import { helpText } from "@/libs/mcp/help";
import { applyEdit } from "@/libs/mcp/noteEdit";
import type { EditChanges } from "@/libs/mcp/noteEdit";
import { booleanFlag, buildNote } from "@/libs/mcp/noteInput";
import { noteForAgent, noteSearchText, noteSummary } from "@/libs/mcp/noteView";
import { findVisibleNote, isVisibleToAgent, NOT_FOUND } from "@/libs/mcp/policy";
import type { McpReply, McpRequest, UpdateCheck } from "@/libs/mcp/types";
import {
  addNote,
  reorderNotes,
  temporaryDeleteNote,
  toggleImportantNotes,
  toggleProtectedNotes,
  toggleReadOnlyNotes,
} from "@/slicers/notesSlice";
import {
  selectorWebhook_addCodeNote,
  selectorWebhook_addKanbanNote,
  selectorWebhook_addTextNote,
  selectorWebhook_addTodoNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import type { Note, NoteType, RootState, WebhookPayload } from "@/types";

/*
 * The tools, on the page's side. Every note reaches them through `policy.ts`. Results are JSON text, errors plain sentences,
 * both in English, for the agent.
 */

/** What the tools need from the app (`bridge.web.ts`). The tests give them a store of their own. */
export interface McpDeps {
  getState(): RootState;
  dispatch(action: unknown): void;
  /** Commits what the editors still hold (ADR-013). `getState()` shows it only after this. */
  commitPending(): void;
  flush(): Promise<void>;
  /** Whether the store has rehydrated and the notes were read: before that, it holds empty state (LL-029, LL-039). */
  ready(): boolean;
  persisted(): boolean;
  sanitize(html: string): string;
  textLimit(): number;
  sendWebhook(payload: WebhookPayload, body: object): void;
  notifyNoteChanged(id: string): void;
  newId(): string;
  now(): number;
  date(): string;
  checkUpdate(): Promise<UpdateCheck>;
  /** The strings under an i18n key, in the app's language (`null` when there are none). */
  helpBody(base: string): Record<string, string> | null;
  /** The string at an i18n key: a topic's `help.<topic>.title`, or a category's `help.cat_*`. */
  helpTitle(key: string): string;
}

const STILL_STARTING = "Fast Memo is still starting: try again in a moment.";
const NOT_AVAILABLE = "Not available yet.";
const UNKNOWN_TOPIC = "No help topic has that key. Call fastmemo_help without a topic for the list of topics.";
const UPDATE_CHECK_FAILED = "Fast Memo couldn't check for updates. Try again later.";
const READ_ONLY = "This note is read-only, so Fast Memo's tools can't change it. The user makes it editable in Fast Memo.";
const NEEDS_REV = "`rev` is required: the `rev` from the last read or creation of this note.";
const STALE_REV =
  "The note changed since it was read, so nothing was edited. Read it again and redo the edit on what it holds now.";
const OUT_OF_SCOPE =
  "Editing existing notes is off in Fast Memo's settings, and only notes created in this session can be edited. The user can turn it on in the settings.";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

const NOT_SAVED = "Fast Memo couldn't save this to disk, so it may be lost when the app closes. Try again.";
/** A created note stays in the app and is queued for upload: a second `create_note` would make a copy. */
const CREATED_NOT_SAVED =
  "The note was created in Fast Memo but isn't saved to disk yet, so it may be lost if the app closes. Don't create it again.";

/** Not `NOT_SAVED`: an edit made twice is applied twice (an append), so the agent is told not to repeat it. */
const EDITED_NOT_SAVED =
  "The change was made in Fast Memo but isn't saved to disk yet, so it may be lost if the app closes. Don't repeat the edit: read the note to see what it holds.";
const TRASHED_NOT_SAVED =
  "The note was moved to the trash in Fast Memo but isn't saved to disk yet, so it may come back if the app closes. Don't trash it again.";

const refused = (text: string): McpReply => ({ text, isError: true });
const result = (value: object): McpReply => ({ text: JSON.stringify(value), isError: false });

/** A whole number from an agent's argument, or `fallback` for anything else. */
const wholeNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;

function listCategories(deps: McpDeps): McpReply {
  const categories = deps
    .getState()
    .categories.items.filter((category) => category.icon !== "none")
    .map((category) => category.name);
  return result({ categories });
}

function searchNotes(args: Record<string, unknown>, deps: McpDeps): McpReply {
  deps.commitPending();
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
  const limit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, wholeNumber(args.limit, DEFAULT_SEARCH_LIMIT)));
  const offset = Math.max(0, wholeNumber(args.offset, 0));

  const matches = deps
    .getState()
    .notes.items.filter(isVisibleToAgent)
    .filter(
      (note) => !query || (note.title ?? "").toLowerCase().includes(query) || noteSearchText(note).toLowerCase().includes(query)
    )
    .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));

  const nextOffset = offset + limit;
  return result({
    notes: matches.slice(offset, nextOffset).map((note) => noteSummary(note, query)),
    ...(nextOffset < matches.length && { nextOffset }),
  });
}

function readNote(args: Record<string, unknown>, deps: McpDeps): McpReply {
  deps.commitPending();
  const note = findVisibleNote(deps.getState().notes.items, args.id);
  if (!note) return refused(NOT_FOUND);
  return result(noteForAgent(note, wholeNumber(args.offset, 0)));
}

/** What the editors send the user's webhook for a note: the same fields, and the content of its type. */
function webhookBody(action: string, note: Note): object {
  const content =
    note.type === "todo"
      ? { list: note.list, mode: note.mode }
      : note.type === "kanban"
        ? { columns: note.columns }
        : note.type === "code"
          ? { tabs: note.tabs, activeTabId: note.activeTabId }
          : { text: note.text };
  return {
    action,
    id: note.id,
    type: note.type,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    important: note.important,
    readOnly: note.readOnly,
    hidden: note.hidden,
    locked: note.locked,
    category: { iconId: note.category?.icon, name: note.category?.name },
    ...content,
  };
}

const ADD_WEBHOOKS: Record<NoteType, { action: string; select: (state: RootState) => WebhookPayload }> = {
  text: { action: "note/addTextNote", select: selectorWebhook_addTextNote },
  todo: { action: "note/addTodoNote", select: selectorWebhook_addTodoNote },
  kanban: { action: "note/addKanbanNote", select: selectorWebhook_addKanbanNote },
  code: { action: "note/addCodeNote", select: selectorWebhook_addCodeNote },
};

/** The user's webhook, once the change is on disk. A failing one doesn't turn a saved change into an error. */
function announce(deps: McpDeps, payload: WebhookPayload, body: object): void {
  try {
    deps.sendWebhook(payload, body);
  } catch (err) {
    console.warn("MCP: a webhook failed", err);
  }
}

/** Writes what was dispatched to disk before the agent is told it's done. */
async function saved(deps: McpDeps): Promise<boolean> {
  await deps.flush();
  return deps.persisted();
}

const findStored = (deps: McpDeps, id: string): Note | undefined => deps.getState().notes.items.find((note) => note.id === id);

/** The listed topics, with the key an agent passes back as `topic`. */
function helpTopics(deps: McpDeps): McpReply {
  const topics = HELP_TOPICS.flatMap(({ catKey, bases }) =>
    bases.map((base) => ({ key: base, title: deps.helpTitle(`${base}.title`), category: deps.helpTitle(catKey) }))
  );
  return result({ topics });
}

function help(args: Record<string, unknown>, deps: McpDeps): McpReply {
  if (args.topic === undefined || args.topic === null) return helpTopics(deps);

  // Only the listed topics: a mobile-only one has its i18n keys too, but isn't about this app.
  const base = typeof args.topic === "string" ? args.topic : "";
  if (!HELP_TOPICS.some((category) => category.bases.includes(base))) return refused(UNKNOWN_TOPIC);

  const body = deps.helpBody(base);
  if (!body) return refused(UNKNOWN_TOPIC);
  return result({ key: base, title: deps.helpTitle(`${base}.title`), text: helpText(body) });
}

async function checkUpdate(deps: McpDeps): Promise<McpReply> {
  let update: UpdateCheck;
  try {
    update = await deps.checkUpdate();
  } catch (err) {
    // Not the error's text: it can hold addresses and paths.
    console.warn("MCP: the update check failed", err);
    return refused(UPDATE_CHECK_FAILED);
  }

  switch (update.kind) {
    case "newer":
      return {
        text: `Fast Memo ${update.current} is installed and ${update.latest} is available. The user installs it in the app: this tool doesn't install anything.`,
        isError: false,
      };
    case "current":
      return { text: `Fast Memo ${update.current} is installed and up to date.`, isError: false };
    case "packageManager":
      return {
        text: `Fast Memo ${update.current} is installed. This install is updated through its package manager, so a newer version has to be looked for there.`,
        isError: false,
      };
  }
}

async function createNote(args: Record<string, unknown>, deps: McpDeps): Promise<McpReply> {
  const built = buildNote(args, deps);
  if ("error" in built) return refused(built.error);

  deps.dispatch(addNote(built.note));
  // The note as the store keeps it: the reducer stamps its revision.
  const note = findStored(deps, built.note.id);
  if (!note) return refused(CREATED_NOT_SAVED);

  if (!(await saved(deps))) return refused(CREATED_NOT_SAVED);
  const webhook = ADD_WEBHOOKS[note.type];
  announce(deps, webhook.select(deps.getState()), webhookBody(webhook.action, note));

  // A locked note is out of the agent's reach from now on: it learns nothing to find it by.
  if (note.locked) return { text: "Created.", isError: false };

  const asked = typeof args.category === "string";
  const matched = note.category.icon !== "none";
  return {
    ...result({
      id: note.id,
      rev: noteRev(note),
      type: note.type,
      title: note.title,
      category: matched ? note.category.name : null,
      ...(asked &&
        !matched && {
          note: "No category matched that name, so the note is in the default category. Names come from fastmemo_list_categories.",
        }),
    }),
    createdId: note.id,
  };
}

async function setNoteFlags(args: Record<string, unknown>, deps: McpDeps): Promise<McpReply> {
  deps.commitPending();
  const found = findVisibleNote(deps.getState().notes.items, args.id);
  if (!found) return refused(NOT_FOUND);

  const flags = [booleanFlag(args, "important"), booleanFlag(args, "readOnly"), booleanFlag(args, "locked")];
  const [important, readOnly, locked] = flags.map((flag) => ("error" in flag ? undefined : flag.value));
  const invalid = flags.find((flag) => "error" in flag);
  if (invalid && "error" in invalid) return refused(invalid.error);

  if (readOnly === false) return refused("`readOnly` can only be set to true: a note is made editable again in Fast Memo.");
  if (locked === false)
    return refused("`locked` can only be set to true: a note is unlocked in Fast Memo, with its secret code.");
  if (important === undefined && readOnly === undefined && locked === undefined) {
    return refused("Give at least one of `important`, `readOnly` or `locked`.");
  }

  // The reducers toggle: dispatch only for a flag that differs. `locked` goes last, as it's part of the key.
  const key = `${found.id}|${found.locked}`;
  let changed = false;
  if (important !== undefined && important !== !!found.important) {
    deps.dispatch(toggleImportantNotes([key]));
    changed = true;
  }
  if (readOnly === true && !found.readOnly) {
    deps.dispatch(toggleReadOnlyNotes([key]));
    changed = true;
  }
  if (locked === true && !found.locked) {
    deps.dispatch(toggleProtectedNotes([key]));
    changed = true;
  }

  const note = findStored(deps, found.id);
  if (!note) return refused(NOT_FOUND);
  // An editor open on this note keeps its own copy: it reloads this one, or its next commit would write the old flags back.
  if (changed) deps.notifyNoteChanged(note.id);
  // On every path: a retry after a failed write finds the flags already set, and must still say whether they're on disk.
  if (!(await saved(deps))) return refused(NOT_SAVED);
  if (changed) announce(deps, selectorWebhook_updateNote(deps.getState()), webhookBody("note/updateNote", note));
  return result({
    id: note.id,
    rev: noteRev(note),
    important: !!note.important,
    readOnly: !!note.readOnly,
    locked: !!note.locked,
  });
}

async function editNote(req: McpRequest, deps: McpDeps): Promise<McpReply> {
  const { args, scope } = req;
  deps.commitPending();
  // Whatever the scope, a note out of reach is unknown: nothing else is said before this.
  const found = findVisibleNote(deps.getState().notes.items, args.id);
  if (!found) return refused(NOT_FOUND);
  if (found.readOnly) return refused(READ_ONLY);
  if (!scope.editAll && !scope.ownedIds.includes(found.id)) return refused(OUT_OF_SCOPE);

  if (typeof args.rev !== "number" || !Number.isFinite(args.rev)) return refused(NEEDS_REV);
  if (args.rev !== noteRev(found)) return refused(STALE_REV);

  const edit = applyEdit(found, args as EditChanges, deps);
  if ("error" in edit) return refused(edit.error);

  // The edited copy is the payload of a change to the stored note: the reducer stamps its revision and queues the upload.
  deps.dispatch(addNote({ ...edit.note, updatedAt: Math.max(deps.now(), (Number(found.updatedAt) || 0) + 1) }));
  deps.dispatch(reorderNotes());
  const note = findStored(deps, found.id);
  if (!note) return refused(EDITED_NOT_SAVED);

  // An editor open on this note reloads it, or its next commit would write the old copy over this one.
  deps.notifyNoteChanged(note.id);
  if (!(await saved(deps))) return refused(EDITED_NOT_SAVED);
  announce(deps, selectorWebhook_updateNote(deps.getState()), webhookBody("note/updateNote", note));
  return result({ id: note.id, rev: noteRev(note), type: note.type, title: note.title });
}

async function trashNote(args: Record<string, unknown>, deps: McpDeps): Promise<McpReply> {
  deps.commitPending();
  const found = findVisibleNote(deps.getState().notes.items, args.id);
  if (!found) return refused(NOT_FOUND);
  if (found.readOnly) return refused(READ_ONLY);

  deps.dispatch(temporaryDeleteNote(found.id));
  // An editor open on the note gets what a trash from another device gives it: a message, and typing brings the note back.
  deps.notifyNoteChanged(found.id);
  if (!(await saved(deps))) return refused(TRASHED_NOT_SAVED);
  // The same body the editors send for a note moved to the trash.
  announce(deps, selectorWebhook_temporaryDeleteNote(deps.getState()), { action: "note/temporaryDeleteNote", id: found.id });
  return result({ id: found.id, trashed: true });
}

export async function handleMcpRequest(req: McpRequest, deps: McpDeps): Promise<McpReply> {
  if (!deps.ready()) return refused(STILL_STARTING);

  switch (req.tool) {
    case "fastmemo_list_categories":
      return listCategories(deps);
    case "fastmemo_search_notes":
      return searchNotes(req.args, deps);
    case "fastmemo_read_note":
      return readNote(req.args, deps);
    case "fastmemo_create_note":
      return createNote(req.args, deps);
    case "fastmemo_set_note_flags":
      return setNoteFlags(req.args, deps);
    case "fastmemo_edit_note":
      return editNote(req, deps);
    case "fastmemo_trash_note":
      return trashNote(req.args, deps);
    case "fastmemo_help":
      return help(req.args, deps);
    case "fastmemo_check_update":
      return checkUpdate(deps);
    default:
      return refused(NOT_AVAILABLE);
  }
}
