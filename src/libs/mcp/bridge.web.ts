import type { UnknownAction } from "@reduxjs/toolkit";
import uuid from "react-uuid";

import { noteTextLimit } from "@/libs/cloud";
import { flushNow } from "@/libs/flushOnExit";
import { handleMcpRequest } from "@/libs/mcp/handlers";
import type { McpDeps } from "@/libs/mcp/handlers";
import type { McpReply, McpRequest } from "@/libs/mcp/types";
import { flushPending } from "@/libs/registry";
import { notesLoaded, notesPersisted, persistor, store } from "@/slicers/store";
import type { RootState } from "@/types";
import { formatDateTime } from "@/utils/date";
import { isTauri } from "@/utils/platform";
import { webhook } from "@/utils/webhook";

/*
 * The page's end of the local MCP server: Rust relays each tool call here as an event, since the notes live in the page, and
 * gets its answer through a command (`src-tauri/src/mcp/`).
 */

const REQUEST_EVENT = "fastmemo://mcp-request";

const notAvailableYet = (): never => {
  throw new Error("not available yet");
};

const deps: McpDeps = {
  getState: () => store.getState() as RootState,
  dispatch: (action) => {
    store.dispatch(action as UnknownAction);
  },
  commitPending: flushPending,
  flush: flushNow,
  ready: () => persistor.getState().bootstrapped && notesLoaded(),
  persisted: notesPersisted,
  sanitize: notAvailableYet,
  textLimit: () => noteTextLimit(false),
  sendWebhook: (payload, body) => {
    webhook(payload, body as Record<string, unknown>);
  },
  notifyNoteChanged: notAvailableYet,
  newId: uuid,
  now: () => Date.now(),
  date: () => formatDateTime(),
  checkUpdate: notAvailableYet,
  helpBody: notAvailableYet,
  helpTitle: notAvailableYet,
};

/** Always an answer, even for a page error: without one, Rust would wait for its timeout. */
const answer = async (request: McpRequest): Promise<McpReply> => {
  try {
    return await handleMcpRequest(request, deps);
  } catch (err) {
    console.warn("MCP: a tool call failed", err);
    return { text: "Fast Memo couldn't carry out this call.", isError: true };
  }
};

export function installMcpBridge(): void {
  if (!isTauri()) return;
  Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")])
    .then(([{ listen }, { invoke }]) =>
      listen<McpRequest>(REQUEST_EVENT, async ({ payload }) => {
        const reply = await answer(payload);
        await invoke("mcp_reply", { id: payload.id, reply }).catch(() => {});
      })
    )
    .catch(() => {});
}
