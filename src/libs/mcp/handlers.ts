import { findVisibleNote, isVisibleToAgent, NOT_FOUND } from "@/libs/mcp/policy";
import { noteForAgent, noteSearchText, noteSummary } from "@/libs/mcp/noteView";
import type { McpReply, McpRequest, UpdateCheck } from "@/libs/mcp/types";
import type { RootState, WebhookPayload } from "@/types";

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
  helpBody(base: string): Record<string, string> | null;
  helpTitle(base: string): string;
}

const STILL_STARTING = "Fast Memo is still starting: try again in a moment.";
const NOT_AVAILABLE = "Not available yet.";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

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

export async function handleMcpRequest(req: McpRequest, deps: McpDeps): Promise<McpReply> {
  if (!deps.ready()) return refused(STILL_STARTING);

  switch (req.tool) {
    case "fastmemo_list_categories":
      return listCategories(deps);
    case "fastmemo_search_notes":
      return searchNotes(req.args, deps);
    case "fastmemo_read_note":
      return readNote(req.args, deps);
    default:
      return refused(NOT_AVAILABLE);
  }
}
