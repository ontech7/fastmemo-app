import { isTauri } from "@/utils/platform";

/*
 * The calls to servers the user picked: the FastMemo server and webhooks. In a browser, the browser's fetch. On desktop
 * they go through Rust (`src-tauri/src/net.rs`): from the webview, Windows (an https:// page) blocks a plain http://
 * address as mixed content, and a server that doesn't answer CORS is refused.
 */

const WEBHOOK_TIMEOUT_MS = 5000;

let nextRequestId = 1;

const tauriCore = () => import("@tauri-apps/api/core");

const cancelled = () => new DOMException("The request was cancelled", "AbortError");

/**
 * `fetch` for the FastMemo server (`ServerBackend`). On desktop: the method, address, headers and a string body go to
 * Rust, the answer comes back as the status and the body bytes; aborting the signal cancels the request there.
 */
export const serverFetch: typeof fetch = async (input, init: RequestInit = {}) => {
  if (!isTauri()) return fetch(input, init);

  const { invoke } = await tauriCore();
  const { signal } = init;
  if (signal?.aborted) throw cancelled();

  const id = nextRequestId++;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = { "x-fm-id": String(id), "x-fm-method": init.method ?? "GET", "x-fm-url": url };
  new Headers(init.headers).forEach((value, name) => {
    headers[`x-fm-h-${name}`] = value;
  });
  const body = typeof init.body === "string" ? new TextEncoder().encode(init.body) : new Uint8Array(0);

  const cancel = () => {
    invoke("net_cancel", { id }).catch(() => {});
  };
  signal?.addEventListener("abort", cancel);
  try {
    const answer = new Uint8Array(await invoke<ArrayBuffer>("net_request", body, { headers }));
    if (signal?.aborted) throw cancelled();
    const status = (answer[0] << 8) | answer[1];
    const nullBody = status === 204 || status === 205 || status === 304;
    return new Response(nullBody ? null : answer.subarray(2), { status });
  } catch (e) {
    throw signal?.aborted ? cancelled() : e;
  } finally {
    signal?.removeEventListener("abort", cancel);
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
