/**
 * What may reach Sentry (ADR-035). Breadcrumbs are an allow-list: a kind not named here (one a Sentry update adds, say)
 * is dropped. Addresses become route patterns, requests keep only the kind of host. No React, React Native or Sentry
 * here, so it is tested under Node.
 */

export type HostKind = "firebase" | "server" | "website" | "other";

export interface ScrubContext {
  /** The FastMemo server in use, if any (never sent: only compared). */
  serverUrl?: string;
  /** The website's API (`configs.apiUrl`). */
  apiUrl?: string;
}

/** Screens whose address segment is a name, not a note id. */
const NEW_NOTE_IDS = new Set(["new-text", "new-todo", "new-kanban", "new-code"]);

/** Breadcrumb categories kept as they are. */
const KEPT = new Set(["app", "app.lifecycle", "device.event", "device.orientation"]);
const NETWORK = new Set(["fetch", "xhr", "http"]);

/** `scheme://host` at the start of an address (no URL parser: Hermes' URL is incomplete). */
const ORIGIN_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i;

/** A path or a whole address as a route pattern: no origin, query or hash, a note's id as `[noteId]`. */
export function routePattern(pathOrUrl: string): string {
  let path = String(pathOrUrl ?? "").replace(ORIGIN_RE, "");
  path = path.split(/[?#]/)[0];
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!path) return "index";

  const parts = path.split("/");
  if (parts[0] === "notes" && parts.length > 1 && !NEW_NOTE_IDS.has(parts[1])) {
    parts[1] = "[noteId]";
  }
  return parts.join("/");
}

const originOf = (url: string | undefined): string | null => {
  const match = url ? ORIGIN_RE.exec(url) : null;
  return match ? match[0].toLowerCase() : null;
};

const hostOf = (url: string): string => {
  const origin = originOf(url);
  return origin
    ? origin
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/^.*@/, "")
    : "";
};

export function hostKind(url: string, context: ScrubContext): HostKind {
  const address = String(url ?? "");
  const host = hostOf(address);
  if (/(^|\.)(googleapis\.com|firebaseio\.com|firebaseapp\.com)$/.test(host)) return "firebase";
  if (context.serverUrl && address.startsWith(context.serverUrl)) return "server";
  const website = originOf(context.apiUrl);
  if (website && originOf(address) === website) return "website";
  return "other";
}

/** The breadcrumb as it may be sent, or null when it must not be. */
export function scrubBreadcrumb<T extends { category?: string; data?: Record<string, unknown>; message?: string }>(
  crumb: T,
  context: ScrubContext
): T | null {
  const category = crumb?.category ?? "";

  if (KEPT.has(category)) return crumb;

  if (category === "navigation") {
    const data: Record<string, unknown> = {};
    if (typeof crumb.data?.from === "string") data.from = routePattern(crumb.data.from);
    if (typeof crumb.data?.to === "string") data.to = routePattern(crumb.data.to);
    const { message: _message, ...rest } = crumb;
    return { ...rest, data } as T;
  }

  if (NETWORK.has(category)) {
    const url = typeof crumb.data?.url === "string" ? crumb.data.url : "";
    const data: Record<string, unknown> = { host: hostKind(url, context) };
    if (crumb.data?.method !== undefined) data.method = crumb.data.method;
    if (crumb.data?.status_code !== undefined) data.status_code = crumb.data.status_code;
    const { message: _message, ...rest } = crumb;
    return { ...rest, data } as T;
  }

  return null;
}

/** The event as it may be sent: its address as a pattern, the user as its id only. */
export function scrubEvent<T extends { request?: { url?: string }; user?: Record<string, unknown> }>(event: T): T {
  const next = { ...event };
  if (next.request?.url !== undefined) {
    next.request = { ...next.request, url: routePattern(next.request.url) };
  }
  if (next.user) {
    next.user = next.user.id !== undefined ? { id: next.user.id } : {};
  }
  return next;
}

const TRANSIENT_CODES = new Set(["unavailable", "deadline-exceeded", "firestore/unavailable", "firestore/deadline-exceeded"]);
const TRANSIENT_MESSAGE = /network|failed to fetch|timed? ?out|offline/i;

/** Being offline or a request that timed out: not an error worth reporting (the engine retries). */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown };
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;
  return typeof message === "string" && TRANSIENT_MESSAGE.test(message);
}
