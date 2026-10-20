import type { CloudProvider, CloudSettings } from "@/types";

/*
 * Which cloud the settings point to, and the scope this device's vault key is cached under (ADR-012): the Firebase project
 * id, or the FastMemo server's address. Pure helpers (the connect screen, the startup and the vault screens use them).
 */

export const providerOf = (settings: Partial<CloudSettings> | null | undefined): CloudProvider =>
  settings?.provider === "server" ? "server" : "firebase";

const IP_OR_LOCAL = /^(localhost|\[[0-9a-f:]+\]|(\d{1,3}\.){3}\d{1,3}|[^/:]+\.local)(:\d+)?(\/|$)/i;

/**
 * The server's address as typed, made usable: no trailing slash, and a scheme when there's none (http:// for an IP address,
 * localhost or a .local name, which have no certificate at home; https:// otherwise).
 */
export const normalizeServerUrl = (input: string): string => {
  const url = input.trim().replace(/\/+$/, "");
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${IP_OR_LOCAL.test(url) ? "http" : "https"}://${url}`;
};

/** Whether the address is plain HTTP (not encrypted in transit). */
export const isPlainHttp = (url: string): boolean => /^http:\/\//i.test(normalizeServerUrl(url));

/** What this device's cached vault key is filed under for these settings. */
export const cloudScope = (settings: Partial<CloudSettings> | null | undefined): string =>
  providerOf(settings) === "server" ? `server:${normalizeServerUrl(settings?.serverUrl ?? "")}` : (settings?.projectId ?? "");

/** Whether the settings have everything a connection needs. */
export const isCloudSettingsComplete = (settings: Partial<CloudSettings>): boolean =>
  providerOf(settings) === "server"
    ? !!normalizeServerUrl(settings.serverUrl ?? "") && (settings.serverKey ?? "").trim().length > 0
    : !!settings.apiKey && !!settings.projectId && !!settings.appId;
