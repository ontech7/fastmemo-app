import { isTauri } from "@/utils/platform";

let tauriFetch: Promise<typeof fetch> | null = null;

/**
 * `fetch` for the calls to servers the user picked (the FastMemo server, webhooks). On desktop they go through Rust
 * (`tauri-plugin-http`): from the webview, Windows (an `https://` page) blocks an `http://` address as mixed content, and
 * any server that doesn't answer CORS is refused. In a browser it's the browser's own.
 */
export const httpFetch: typeof fetch = (input, init) => {
  if (!isTauri()) return fetch(input, init);
  tauriFetch ??= import("@tauri-apps/plugin-http").then(({ fetch: rustFetch }) => rustFetch);
  return tauriFetch.then((rustFetch) => rustFetch(input, init));
};
