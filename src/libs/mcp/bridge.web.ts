import type { UnknownAction } from "@reduxjs/toolkit";
import DOMPurify from "dompurify";
import type { DOMPurify as DOMPurifyInstance } from "dompurify";
import uuid from "react-uuid";

import { addNoteHooks, NOTE_HTML_CONFIG } from "@/editor/sanitizeConfig";
import { noteTextLimit } from "@/libs/cloud";
import { notifyNoteChanged } from "@/libs/cloud/sync";
import { checkDesktopUpdate } from "@/libs/desktopUpdater";
import { flushNow } from "@/libs/flushOnExit";
import i18n from "@/libs/i18n";
import { handleMcpRequest } from "@/libs/mcp/handlers";
import type { McpDeps } from "@/libs/mcp/handlers";
import type { McpReply, McpRequest, UpdateCheck } from "@/libs/mcp/types";
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

let purifier: DOMPurifyInstance | null = null;

/** HTML from an agent comes from outside, like an import: it's cleaned as the editor's own is (ADR-021, LL-060). */
const sanitize = (html: string): string => {
  if (!purifier) {
    purifier = DOMPurify(window);
    addNoteHooks(purifier);
  }
  return purifier.sanitize(html, NOTE_HTML_CONFIG) as string;
};

/** Whether a newer desktop version exists. Deb and rpm installs update through their package manager: that's said, not "up to date". */
async function checkUpdate(): Promise<UpdateCheck> {
  const { BundleType, getBundleType, getVersion } = await import("@tauri-apps/api/app");
  const current = await getVersion();
  const bundleType = await getBundleType();
  if (bundleType === BundleType.Deb || bundleType === BundleType.Rpm) return { kind: "packageManager", current };

  const update = await checkDesktopUpdate();
  if (!update) return { kind: "current", current };
  try {
    return { kind: "newer", current, latest: update.version };
  } finally {
    // The update holds a resource on the Rust side; a failed release doesn't fail the check.
    try {
      await update.close();
    } catch {
      // Nothing more to do with it.
    }
  }
}

/** The strings under an i18n key, or null when the key holds one string or none. */
function helpBody(base: string): Record<string, string> | null {
  const body: unknown = i18n.t(base, { returnObjects: true });
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, string>) : null;
}

const deps: McpDeps = {
  getState: () => store.getState() as RootState,
  dispatch: (action) => {
    store.dispatch(action as UnknownAction);
  },
  commitPending: flushPending,
  flush: flushNow,
  ready: () => persistor.getState().bootstrapped && notesLoaded(),
  persisted: notesPersisted,
  sanitize,
  textLimit: () => noteTextLimit(false),
  sendWebhook: (payload, body) => {
    webhook(payload, body as Record<string, unknown>);
  },
  notifyNoteChanged,
  newId: uuid,
  now: () => Date.now(),
  date: () => formatDateTime(),
  checkUpdate,
  helpBody,
  helpTitle: (key) => String(i18n.t(key)),
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

/** What stops listening for the requests, kept on `globalThis`: a Fast Refresh runs this module again, and the old listener would answer too. */
const holder = globalThis as { __fastmemoMcpListening?: Promise<() => void> };

export function installMcpBridge(): void {
  if (!isTauri()) return;
  const previous = holder.__fastmemoMcpListening;
  // One listener at a time: a second install replaces the first, and each request is answered once (a note created twice).
  holder.__fastmemoMcpListening = Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")])
    .then(([{ listen }, { invoke }]) =>
      listen<McpRequest>(REQUEST_EVENT, async ({ payload }) => {
        const reply = await answer(payload);
        await invoke("mcp_reply", { id: payload.id, reply }).catch(() => {});
      })
    )
    .catch((err) => {
      console.warn("MCP: the bridge couldn't start", err);
      return () => {};
    });
  previous?.then((unlisten) => unlisten()).catch(() => {});
}
