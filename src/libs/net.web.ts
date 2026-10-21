import { isTauri } from "@/utils/platform";

/*
 * The calls to servers the user picked: the FastMemo server and webhooks. In a browser, the browser's fetch. On desktop
 * they go through Rust (`src-tauri/src/net.rs`): from the webview, Windows (an https:// page) blocks a plain http://
 * address as mixed content, and a server that doesn't answer CORS is refused.
 */

// Missing before Safari 16.
AbortSignal.timeout ??= function timeout(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
};

const WEBHOOK_TIMEOUT_MS = 5000;

/** This page load's prefix for request ids: Rust outlives a reload, and a request from before must not pass for a new one. */
const LOAD_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let nextRequestId = 1;

const tauriCore = () => import("@tauri-apps/api/core");

const cancelled = () => new DOMException("The request was cancelled", "AbortError");

/**
 * `fetch` for the FastMemo server (`ServerBackend`). On desktop: the method, address, headers and a string body go to
 * Rust, the answer comes back as the status and the body bytes; aborting the signal rejects at once and cancels the
 * request there.
 */
export const serverFetch: typeof fetch = async (input, init: RequestInit = {}) => {
  if (!isTauri()) return fetch(input, init);

  const { signal } = init;
  const text = init.body ?? "";
  if (typeof text !== "string") throw new TypeError("serverFetch sends only text bodies");
  const { invoke } = await tauriCore();
  if (signal?.aborted) throw cancelled();

  const id = `${LOAD_ID}-${nextRequestId++}`;
  // Written out in ASCII (punycode, percent-encoding): it travels in a header.
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url).href;
  const headers: Record<string, string> = {
    "x-fm-id": id,
    "x-fm-method": (init.method ?? "GET").toUpperCase(),
    "x-fm-url": url,
  };
  new Headers(init.headers).forEach((value, name) => {
    headers[`x-fm-h-${name}`] = value;
  });
  const body = new TextEncoder().encode(text);

  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      invoke("net_cancel", { id }).catch(() => {});
      reject(cancelled());
    };
  });
  signal?.addEventListener("abort", onAbort);
  try {
    const answer = new Uint8Array(await Promise.race([invoke<ArrayBuffer>("net_request", body, { headers }), aborted]));
    const status = (answer[0] << 8) | answer[1];
    const nullBody = status === 204 || status === 205 || status === 304;
    return new Response(nullBody ? null : answer.subarray(2), { status });
  } catch (e) {
    throw signal?.aborted ? cancelled() : e;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
};

/** POSTs a webhook's JSON body; only whether it got there matters. */
export async function postWebhook(url: string, body: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await tauriCore();
    await invoke("net_webhook", { url, body });
    return;
  }
  await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body,
  });
}
