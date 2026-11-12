/**
 * What a report carries and how it is sent (ADR-035). No React, Redux, React Native, Expo or Sentry here: the crash
 * screen builds and sends its report with these functions while the rest of the app may be broken.
 */

export type CloudKind = "none" | "firebase" | "server";

/** Sent with every report, whatever the device-information box says. */
export interface AlwaysFacts {
  appVersion: string;
  os: string;
  osVersion?: string;
  appLanguage: string;
  installId: string;
}

/** Sent only with the device-information box ticked. `appVersion` stays for the website's 4.0.0 template. */
export interface DeviceFacts {
  brand: string;
  modelName: string;
  deviceType: string;
  cloud: CloudKind;
  appIcon: string;
  appVersion: string;
}

export interface ReportAttachment {
  filename: string;
  content: string;
  encoding: "base64";
}

export interface ReportInput {
  topics: string[];
  description: string;
  email?: string;
  attachments?: ReportAttachment[];
  always: AlwaysFacts;
  deviceInfo?: DeviceFacts;
  sentryEventId?: string;
}

/** A report after `buildReportPayload`: trimmed, empty parts left out, only the fields named above. */
export type ReportPayload = ReportInput;

export interface Row {
  key: string;
  value: string;
}

export const REPORT_LIMIT = 3;
export const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Below this many characters the screen suggests saying more (it never blocks sending). */
export const SHORT_DESCRIPTION = 20;
/** The description of a crash report sent with an empty field. */
export const CRASH_NO_TEXT = "(no description)";
/** The base64 characters of all the pictures of one report together (the website takes 4 MB of body). */
export const ATTACHMENTS_MAX_BYTES = 3_000_000;

const ALWAYS_KEYS = ["appVersion", "os", "osVersion", "appLanguage", "installId"] as const;
const DEVICE_KEYS = ["brand", "modelName", "deviceType", "cloud", "appIcon", "appVersion"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Copies only the named keys that hold a string: a stray key (a device name, say) is never carried over. */
function pick<K extends string>(source: Record<string, unknown> | undefined, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!source) return out;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function buildReportPayload(input: ReportInput): ReportPayload {
  const payload: ReportPayload = {
    topics: input.topics.filter((topic) => typeof topic === "string"),
    description: (input.description ?? "").trim(),
    always: pick(input.always as unknown as Record<string, unknown>, ALWAYS_KEYS) as AlwaysFacts,
  };

  const email = input.email?.trim();
  if (email) payload.email = email;

  if (input.attachments && input.attachments.length > 0) {
    payload.attachments = input.attachments.map(({ filename, content }) => ({ filename, content, encoding: "base64" }));
  }

  if (input.deviceInfo) {
    payload.deviceInfo = pick(input.deviceInfo as unknown as Record<string, unknown>, DEVICE_KEYS) as DeviceFacts;
  }

  if (input.sentryEventId) payload.sentryEventId = input.sentryEventId;

  return payload;
}

const rowsOf = (source: Record<string, unknown>, keys: readonly string[]): Row[] =>
  keys.filter((key) => typeof source[key] === "string").map((key) => ({ key, value: source[key] as string }));

/** Every value exactly as it is sent, in three groups (the always-sent facts, device information, the rest). */
export function payloadRows(payload: ReportPayload): { always: Row[]; device: Row[] | null; rest: Row[] } {
  const rest: Row[] = [
    { key: "topics", value: payload.topics.join(", ") },
    { key: "descriptionLength", value: String(payload.description.length) },
    { key: "images", value: String(payload.attachments?.length ?? 0) },
  ];
  if (payload.email) rest.push({ key: "email", value: payload.email });

  return {
    always: rowsOf(payload.always as unknown as Record<string, unknown>, ALWAYS_KEYS),
    device: payload.deviceInfo ? rowsOf(payload.deviceInfo as unknown as Record<string, unknown>, DEVICE_KEYS) : null,
    rest,
  };
}

const parseDate = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
};

/**
 * The sends still counted at `now`: the ISO dates of the last 24 hours. A `reportDate` later than `now` is 4.0.0's
 * one-a-day lock (the date the next report was allowed from): it counts as one send made a day before it.
 */
export function pruneReportLog(log: string[] | undefined, reportDate: string | null | undefined, now: number): string[] {
  const since = now - REPORT_WINDOW_MS;
  const kept = (Array.isArray(log) ? log : []).filter((entry) => {
    const time = parseDate(entry);
    return time !== null && time > since;
  });

  const lock = parseDate(reportDate);
  if (lock !== null && lock > now) {
    kept.push(new Date(lock - REPORT_WINDOW_MS).toISOString());
  }

  return kept;
}

const recentTimes = (log: string[], now: number): number[] =>
  log
    .map(parseDate)
    .filter((time): time is number => time !== null && time > now - REPORT_WINDOW_MS)
    .sort((a, b) => a - b);

export function canSendReport(log: string[], now: number): boolean {
  return recentTimes(log, now).length < REPORT_LIMIT;
}

/** When the next report is allowed, or null when one can be sent now. */
export function nextReportAt(log: string[], now: number): number | null {
  const times = recentTimes(log, now);
  if (times.length < REPORT_LIMIT) return null;
  return times[times.length - REPORT_LIMIT] + REPORT_WINDOW_MS;
}

export function isEmailValid(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function attachmentsFit(attachments: ReportAttachment[]): boolean {
  let total = 0;
  for (const attachment of attachments) total += attachment.content.length;
  return total <= ATTACHMENTS_MAX_BYTES;
}

/** Posts a report. `ok` only when the answer is JSON with `success: true`. Never throws. */
/**
 * How long a send waits for the website's answer: 10 s, or 60 s when pictures ride along (up to 3 MB to upload on a
 * phone's uplink, then the website mails it).
 */
export function reportTimeoutMs(payload: ReportPayload): number {
  return payload.attachments?.length ? 60_000 : 10_000;
}

export async function sendReport(
  payload: ReportPayload,
  apiUrl: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {}
): Promise<{ ok: boolean; error?: unknown }> {
  const doFetch = options.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? reportTimeoutMs(payload));

  try {
    const response = await doFetch(`${apiUrl}/report/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json();
    if (body && body.success === true) return { ok: true };
    return { ok: false, error: new Error("report refused") };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
