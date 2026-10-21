/**
 * `fetch` for the calls to servers the user picked (the FastMemo server, webhooks). On the phone it's the platform's own;
 * the web build uses the `.web.ts` sibling, which goes through Rust on desktop.
 */
export const httpFetch: typeof fetch = (input, init) => fetch(input, init);
