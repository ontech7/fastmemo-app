import type { CloudProvider, CloudSettings } from "@/types";

/*
 * Which cloud the settings point to, and the scope this device's vault key is cached under (ADR-012): the Firebase project
 * id, or the FastMemo server's address. Pure helpers (the connect screen, the startup and the vault screens use them).
 */

export const providerOf = (settings: Partial<CloudSettings> | null | undefined): CloudProvider =>
  settings?.provider === "server" ? "server" : "firebase";

const IP_OR_LOCAL = /^(localhost|\[[0-9a-f:]+\]|(\d{1,3}\.){3}\d{1,3}|[^/:?#@]+\.local)(:\d+)?(\/|$)/i;

/**
 * The server's address as typed, made usable: no trailing slash, a scheme when there's none (http:// for an IP address,
 * localhost or a .local name, which have no certificate at home; https:// otherwise), and the scheme and host in lower
 * case (the same server however it's typed: another spelling would read as another cloud). The path keeps its case.
 */
export const normalizeServerUrl = (input: string): string => {
  const url = input.trim().replace(/\/+$/, "");
  if (!url) return "";
  const full = /^https?:\/\//i.test(url) ? url : `${IP_OR_LOCAL.test(url) ? "http" : "https"}://${url}`;
  return full.replace(/^[a-z]+:\/\/[^/?#]*/i, (origin) => origin.toLowerCase());
};

/** Whether the address is plain HTTP (not encrypted in transit). */
export const isPlainHttp = (url: string): boolean => /^http:\/\//i.test(normalizeServerUrl(url));

const LOOPBACK = /^https?:\/\/(localhost|[^/:?#@]+\.localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?(\/|$)/i;

/** Whether the address is this machine, which a page served over HTTPS may still reach over plain HTTP. */
export const isLoopbackUrl = (url: string): boolean => LOOPBACK.test(normalizeServerUrl(url));

const TAILSCALE = /^https?:\/\/(100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])(\.\d{1,3}){2}|[^/:?#@]+\.ts\.net)(:\d+)?(\/|$)/i;

/** Whether the address goes through Tailscale (its 100.64.0.0/10 addresses and *.ts.net names), encrypted on the way. */
export const isTailscaleUrl = (url: string): boolean => TAILSCALE.test(normalizeServerUrl(url));

/** What this device's cached vault key is filed under for these settings. */
export const cloudScope = (settings: Partial<CloudSettings> | null | undefined): string =>
  providerOf(settings) === "server" ? `server:${normalizeServerUrl(settings?.serverUrl ?? "")}` : (settings?.projectId ?? "");

/** Whether the settings have everything a connection needs. */
export const isCloudSettingsComplete = (settings: Partial<CloudSettings>): boolean =>
  providerOf(settings) === "server"
    ? !!normalizeServerUrl(settings.serverUrl ?? "") && (settings.serverKey ?? "").trim().length > 0
    : !!settings.apiKey && !!settings.projectId && !!settings.appId;
