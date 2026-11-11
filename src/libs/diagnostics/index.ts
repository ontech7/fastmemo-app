/*
 * What @sentry/react-native 8.28 does on its own (read on 2026-11-11 in its docs and in dist/js), which the choices below
 * rest on:
 * 1. Fatal JS errors: the default `reactNativeErrorHandlersIntegration` (onerror: true) takes ErrorUtils' global handler
 *    at init, captures a fatal at level "fatal" with mechanism { type: "onerror", handled: false }, then calls the handler
 *    that was set before it. On the web `browserGlobalHandlers` does the same from window.onerror / unhandledrejection.
 *    So a handler set before `Sentry.init` that also captures reported every fatal twice, the second time unmarked.
 * 2. A `touch` breadcrumb (TouchEventBoundary, part of `Sentry.wrap`) carries "Touch event within element: <label>" and
 *    `data.path`: the touched components' names and accessibility labels, which can be a note's title. Dropped.
 * 3. `beforeBreadcrumb(crumb)` / `beforeSend(event)` return what is sent, or null; `setTags` / `setUser({ id })` apply to
 *    every later event; `Sentry.ErrorBoundary` (from @sentry/react) renders `fallback({ error, eventId, resetError })`
 *    after capturing the render error.
 */
import * as Sentry from "@sentry/react-native";

import { configs } from "@/configs";
import { OTA_REVISION } from "@/utils/version";

import { appVersionWithUpdate, getOs, getPlatformKind } from "./facts";
import { getInstallId } from "./installId";
import type { AlwaysFacts, CloudKind } from "./report";
import { isTransientNetworkError, scrubBreadcrumb, scrubEvent, type ScrubContext } from "./scrub";

const SENTRY_DSN = "https://1b0f816610bb05a5257bfa7ae165f49e@o4509804550750208.ingest.de.sentry.io/4509804582207568";

const MAX_MESSAGE = 300;

/** What `hostKind` compares request addresses with. The server's address is never sent. */
const scrubContext: ScrubContext = { apiUrl: configs.apiUrl || undefined };

/** Each distinct failure is reported once per session: a loop that fails every second must not flood Sentry. */
const reported = new Set<string>();

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : String(error);

let initialized = false;

/** Sentry's init, its scrubbing, and the tags known at start. Called once, from app/_layout.tsx. */
export function initDiagnostics(): void {
  if (initialized) return;
  initialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: configs.environment,
    sendDefaultPii: false,
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, scrubContext),
    beforeSend: (event) => scrubEvent(event),
  });

  Sentry.setTags({ ota: String(OTA_REVISION), platform_kind: getPlatformKind() });
  getInstallId().then((id) => Sentry.setUser({ id }));
}

/** The tags that change while the app runs: its language and the kind of cloud. */
export function setDiagnosticsContext(next: { language: string; cloud: CloudKind; serverUrl?: string }): void {
  scrubContext.serverUrl = next.serverUrl || undefined;
  Sentry.setTags({ app_language: next.language, cloud: next.cloud });
}

/**
 * A handled failure worth knowing: tagged with its `area`, never with content (`extra` holds ids, counts and codes).
 * Being offline or a timeout the engine retries is not reported.
 */
export function reportHandled(area: string, error: unknown, extra?: Record<string, string | number | boolean>): void {
  if (isTransientNetworkError(error)) return;
  const key = `${area}|${messageOf(error)}`;
  if (reported.has(key)) return;
  reported.add(key);
  Sentry.captureException(error, { tags: { area }, extra });
}

/** An error inside an editor's page, as `PAGE_ERROR_SCRIPT` forwards it: message, file, line. Nothing else is read. */
export function reportPageError(page: "richtext" | "codemirror", data: unknown): void {
  if (!data || typeof data !== "object") return;
  const raw = data as { message?: unknown; file?: unknown; line?: unknown };
  if (typeof raw.message !== "string" || !raw.message) return;

  const message = raw.message.slice(0, MAX_MESSAGE);
  const file = typeof raw.file === "string" ? (raw.file.split(/[/\\]/).pop() ?? "") : "";
  const line = typeof raw.line === "number" ? raw.line : 0;

  const key = `page|${page}|${message}`;
  if (reported.has(key)) return;
  reported.add(key);
  Sentry.captureMessage(`page error: ${message}`, { level: "error", tags: { page }, extra: { file, line } });
}

/** A step of the trail that leads to an error: a route, or one of the named actions. */
export function addTrail(name: string, data?: Record<string, string | number | boolean>): void {
  Sentry.addBreadcrumb({ category: "app", message: name, data, level: "info" });
}

/** What every report carries: the app version with its update, the system, the language given, the installation code. */
export async function collectAlwaysFacts(appLanguage: string): Promise<AlwaysFacts> {
  return { appVersion: appVersionWithUpdate(), ...getOs(), appLanguage, installId: await getInstallId() };
}
