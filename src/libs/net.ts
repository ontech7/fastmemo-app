/*
 * The calls to servers the user picked: the FastMemo server and webhooks. On the phone, the platform's own fetch; the web
 * build uses the `.web.ts` sibling, which goes through Rust on desktop.
 */

AbortSignal.timeout ??= function timeout(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
};

const WEBHOOK_TIMEOUT_MS = 5000;

/** `fetch` for the FastMemo server (`ServerBackend`). */
export const serverFetch: typeof fetch = (input, init) => fetch(input, init);

/** POSTs a webhook's JSON body; only whether it got there matters. */
export async function postWebhook(url: string, body: string): Promise<void> {
  await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body,
  });
}
