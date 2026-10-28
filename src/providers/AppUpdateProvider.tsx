import * as Sentry from "@sentry/react-native";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import ArrowDownTrayIcon from "react-native-heroicons/outline/ArrowDownTrayIcon";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ProgressBar from "@/components/ui/ProgressBar";
import useNetInfo from "@/hooks/useNetInfo";
import { checkLatestAppVersion } from "@/libs/api/checkLatestVersion";
import {
  clearDownloadedApk,
  downloadAndInstallApk,
  ensureInstallAllowed,
  isApkBuild,
  isTrustedApkUrl,
} from "@/libs/apkUpdater";
import type { ApkDownload } from "@/libs/apkUpdater";
import { checkDesktopUpdate as checkSignedDesktopUpdate, installDesktopUpdate } from "@/libs/desktopUpdater";
import type { DesktopUpdate } from "@/libs/desktopUpdater";
import { flushNow } from "@/libs/flushOnExit";
import { openUrl } from "@/utils/openUrl";
import { isTauri } from "@/utils/platform";
import { toast } from "@/utils/toast";
import { getCurrentAppVersion, isDesktopOrWeb, isNewerVersion, pickUpdateUrl } from "@/utils/version";

import type { AppVersionResponse } from "@/types";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

interface AppUpdateContextValue {
  /** True when a newer app version is published for the current platform. */
  updateAvailable: boolean;
  /** Raw release URL from the API (platform-agnostic). */
  releaseUrl: string | null;
  /** Open the right update destination for the current platform (the in-app installer on desktop). */
  openUpdate: () => void;
  /**
   * Desktop only: ask the updater for a newer signed build and offer to install it. Resolves to whether one was found;
   * rejects when the check fails.
   */
  checkDesktopUpdate: () => Promise<boolean>;
  /**
   * GitHub APK only: ask the API for a newer release and offer to install it. Resolves to whether one was found, or null
   * when the check failed.
   */
  checkApkUpdate: () => Promise<boolean | null>;
}

/** GitHub APK: a newer release it can install itself (ADR-031). */
interface ApkUpdate {
  version: string;
  changelog: string;
  apkUrl: string;
  /** Bytes, when the site says (older sites don't). */
  apkSize?: number;
}

/** GitHub APK: the download under way (bytes). */
interface ApkProgress {
  percent: number;
  written: number;
  total: number;
}

/** Bytes as megabytes with one decimal ("42.3"). */
const toMegabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** The APK prompt shows this many lines of the release notes at most: the dialog doesn't scroll, its buttons must fit. */
const APK_NOTES_MAX_LINES = 6;

/** The release notes' bullets, without their "•" (the list draws its own). */
function noteLines(changelog: string): string[] {
  return changelog
    .split("\n")
    .map((line) => line.replace(/^\s*[•*-]\s*/, "").trim())
    .filter(Boolean);
}

/** Desktop: how often a running app looks for a newer build. */
const DESKTOP_RECHECK_MS = 6 * 60 * 60 * 1000;
/** How often it looks at the time since the last check (a sleeping computer pauses timers). */
const DESKTOP_RECHECK_TICK_MS = 60 * 60 * 1000;

const AppUpdateContext = createContext<AppUpdateContextValue>({
  updateAvailable: false,
  releaseUrl: null,
  openUpdate: () => {},
  checkDesktopUpdate: async () => false,
  checkApkUpdate: async () => false,
});

/** Shared "an update is available" state, checked once for the whole app. */
export const useAppUpdate = () => useContext(AppUpdateContext);

export default function AppUpdateProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  // Desktop: the signed update the Tauri updater found, and whether its install prompt is showing.
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdate | null>(null);
  const [isDesktopPromptOpen, setIsDesktopPromptOpen] = useState(false);
  const desktopUpdateRef = useRef<DesktopUpdate | null>(null);
  // The version whose prompt was shown, so a later check doesn't show it again.
  const offeredVersionRef = useRef<string | null>(null);
  // An install runs once: a second one would download and swap the app again.
  const isInstallingRef = useRef(false);
  // GitHub APK: the release it can install, its prompt, and the download under way (null when none).
  const [apkUpdate, setApkUpdate] = useState<ApkUpdate | null>(null);
  const [isApkPromptOpen, setIsApkPromptOpen] = useState(false);
  const [apkProgress, setApkProgress] = useState<ApkProgress | null>(null);
  const apkDownloadRef = useRef<ApkDownload | null>(null);
  const isAskingInstallRef = useRef(false);

  const { isConnected } = useNetInfo();

  // Whether `data` has a newer version for this platform; records where to get it.
  const applyLatest = useCallback((data: AppVersionResponse) => {
    const desktop = isDesktopOrWeb();
    const latest = desktop ? data.desktop.version : data.mobile.version;
    if (!isNewerVersion(getCurrentAppVersion(), latest)) return false;

    // A desktop hotfix isn't in the latest release (that one is the store version's): its own page has its builds.
    setReleaseUrl((desktop && data.desktop.releaseUrl) || data.releaseUrl);
    // A release without an APK: the icon opens its GitHub page instead (pickUpdateUrl). An APK from anywhere else than the
    // app's GitHub releases is never offered. The release being downloaded stays the one shown until it's done.
    const { apkUrl, apkSize } = data.mobile;
    if (!desktop && isApkBuild() && apkUrl && isTrustedApkUrl(apkUrl)) {
      setApkUpdate((previous) =>
        apkDownloadRef.current || isAskingInstallRef.current
          ? previous
          : { version: latest, changelog: data.mobile.changelog, apkUrl, apkSize }
      );
    }
    return true;
  }, []);

  // The APK an installed update left in the cache.
  useEffect(() => {
    clearDownloadedApk();
  }, []);

  // Check the remote API for a newer version. Re-runs when connectivity is
  // (re)gained; silently no-ops on any failure (see checkLatestAppVersion).
  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;

    checkLatestAppVersion().then((data) => {
      if (!cancelled && data) applyLatest(data);
    });

    return () => {
      cancelled = true;
    };
  }, [isConnected, applyLatest]);

  const checkApkUpdate = useCallback(async () => {
    const data = await checkLatestAppVersion();
    if (!data) return null;
    const found = applyLatest(data);
    if (found) setIsApkPromptOpen(true);
    return found;
  }, [applyLatest]);

  const confirmApkUpdate = useCallback(async () => {
    if (!apkUpdate || apkDownloadRef.current || isAskingInstallRef.current) return;

    // The first time, the system page to let FastMemo install apps; the download starts once the user is back.
    isAskingInstallRef.current = true;
    const allowed = await ensureInstallAllowed().catch(() => false);
    isAskingInstallRef.current = false;
    if (!allowed) {
      setIsApkPromptOpen(false);
      toast(t("generalsettings.update_not_allowed"));
      return;
    }

    setApkProgress({ percent: 0, written: 0, total: 0 });
    // Once per whole percent: the provider re-renders on each change, not on each chunk.
    const download = downloadAndInstallApk(
      apkUpdate.apkUrl,
      (written, total) => {
        const percent = Math.floor((written / total) * 100);
        setApkProgress((previous) => (previous?.percent === percent ? previous : { percent, written, total }));
      },
      flushNow
    );
    apkDownloadRef.current = download;
    download.done
      .then(() => setIsApkPromptOpen(false))
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === "cancelled") return;
        Sentry.captureException(error);
        // the native check: the file isn't FastMemo signed with this app's key (a tampered or wrong asset)
        const notVerified = (error as { code?: string } | null)?.code === "E_NOT_VERIFIED";
        toast(t(notVerified ? "generalsettings.update_not_verified" : "generalsettings.update_download_failed"));
      })
      .finally(() => {
        apkDownloadRef.current = null;
        setApkProgress(null);
      });
  }, [apkUpdate, t]);

  const cancelApkDownload = useCallback(() => {
    apkDownloadRef.current?.cancel();
    setIsApkPromptOpen(false);
  }, []);

  // `offerAgain`: show the prompt even for the version already offered (the user asked, from Settings).
  const findDesktopUpdate = useCallback(async (offerAgain: boolean) => {
    if (isInstallingRef.current) return true;
    const update = await checkSignedDesktopUpdate();
    // Each found update holds a resource on the Rust side until closed.
    desktopUpdateRef.current?.close().catch(() => {});
    desktopUpdateRef.current = update;
    setDesktopUpdate(update);
    if (!update) {
      setIsDesktopPromptOpen(false);
    } else if (offerAgain || update.version !== offeredVersionRef.current) {
      offeredVersionRef.current = update.version;
      setIsDesktopPromptOpen(true);
    }
    return update !== null;
  }, []);

  const checkDesktopUpdate = useCallback(() => findDesktopUpdate(true), [findDesktopUpdate]);

  // Desktop: offer a found update at launch, like the old built-in updater did (without its native dialog, which could
  // hang the app), then look again every DESKTOP_RECHECK_MS while the app runs: on macOS closing the window leaves it
  // running for days (ADR-022). A version already offered isn't offered again (Settings still shows it). A failed check
  // (e.g. offline) is retried on the next connection, or the next tick.
  const lastDesktopCheckRef = useRef(0);
  const recheckDesktop = useCallback(() => {
    if (!isTauri() || Date.now() - lastDesktopCheckRef.current < DESKTOP_RECHECK_MS) return;
    lastDesktopCheckRef.current = Date.now();
    findDesktopUpdate(false).catch(() => {
      lastDesktopCheckRef.current = 0;
    });
  }, [findDesktopUpdate]);

  useEffect(() => {
    if (isConnected) recheckDesktop();
  }, [isConnected, recheckDesktop]);

  useEffect(() => {
    if (!isTauri()) return;
    const timer = setInterval(recheckDesktop, DESKTOP_RECHECK_TICK_MS);
    // The window coming back is when an update is worth offering.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recheckDesktop();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [recheckDesktop]);

  const confirmDesktopUpdate = useCallback(async () => {
    setIsDesktopPromptOpen(false);
    const update = desktopUpdateRef.current;
    if (!update || isInstallingRef.current) return;

    isInstallingRef.current = true;
    toast(t("generalsettings.update_installing"));
    try {
      await installDesktopUpdate(update, flushNow);
    } catch (error) {
      isInstallingRef.current = false;
      toast(`${t("error")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [t]);

  const openUpdate = useCallback(() => {
    if (isInstallingRef.current) {
      toast(t("generalsettings.update_installing"));
      return;
    }
    if (desktopUpdate) {
      setIsDesktopPromptOpen(true);
      return;
    }
    // GitHub APK: the prompt, or the download under way.
    if (apkUpdate) {
      setIsApkPromptOpen(true);
      return;
    }
    if (!releaseUrl) return;
    // Desktop: the API saw a release the launch check missed (e.g. it ran offline): prefer the in-app installer.
    if (isTauri()) {
      checkDesktopUpdate()
        .then((found) => {
          if (!found) openUrl(pickUpdateUrl(releaseUrl));
        })
        .catch(() => openUrl(pickUpdateUrl(releaseUrl)));
      return;
    }
    openUrl(pickUpdateUrl(releaseUrl));
  }, [desktopUpdate, apkUpdate, releaseUrl, checkDesktopUpdate, t]);

  const apkNotes = apkUpdate ? noteLines(apkUpdate.changelog) : [];

  return (
    <AppUpdateContext.Provider
      value={{
        updateAvailable: releaseUrl != null || desktopUpdate != null,
        releaseUrl,
        openUpdate,
        checkDesktopUpdate,
        checkApkUpdate,
      }}
    >
      {children}

      {desktopUpdate && (
        <ComplexDialog
          open={isDesktopPromptOpen}
          adornmentStart={<ArrowDownTrayIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
          title={`${t("generalsettings.update_available")}: v${desktopUpdate.version}`}
          description={t("generalsettings.update_confirm")}
          cancel={{ label: t("cancel"), handler: () => setIsDesktopPromptOpen(false) }}
          confirm={{ label: t("generalsettings.update_install"), handler: confirmDesktopUpdate }}
        />
      )}

      {apkUpdate &&
        (apkProgress == null ? (
          <ComplexDialog
            open={isApkPromptOpen}
            adornmentStart={<ArrowDownTrayIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
            title={`${t("generalsettings.update_available")}: v${apkUpdate.version}`}
            cancel={{ label: t("cancel"), handler: () => setIsApkPromptOpen(false) }}
            confirm={{ label: t("generalsettings.update_install"), handler: confirmApkUpdate }}
            onDismiss={() => setIsApkPromptOpen(false)}
          >
            {apkNotes.length > 0 && (
              <View style={styles.notes}>
                {apkNotes.slice(0, APK_NOTES_MAX_LINES).map((line, i) => (
                  <View key={i} style={styles.note}>
                    <Text style={styles.noteText}>•</Text>
                    <Text style={[styles.noteText, styles.noteLine]}>{line}</Text>
                  </View>
                ))}
                {apkNotes.length > APK_NOTES_MAX_LINES && <Text style={styles.noteText}>…</Text>}
              </View>
            )}
            <Text style={styles.noteText}>{t("generalsettings.update_confirm")}</Text>
            {apkUpdate.apkSize != null && apkUpdate.apkSize > 0 && (
              <Text style={styles.size}>{t("generalsettings.update_size", { size: toMegabytes(apkUpdate.apkSize) })}</Text>
            )}
          </ComplexDialog>
        ) : (
          // Hide (or a tap outside) and the download goes on: the icon shows it again.
          <ComplexDialog
            open={isApkPromptOpen}
            adornmentStart={<ArrowDownTrayIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
            title={t("generalsettings.update_downloading", { version: apkUpdate.version })}
            cancel={{ label: t("generalsettings.update_hide"), handler: () => setIsApkPromptOpen(false) }}
            confirm={{ label: t("cancel"), handler: cancelApkDownload }}
            onDismiss={() => setIsApkPromptOpen(false)}
          >
            <View style={styles.download}>
              <View style={styles.downloadFigures}>
                <Text style={styles.downloadPercent}>{apkProgress.percent}%</Text>
                {apkProgress.total > 0 && (
                  <Text style={styles.downloadSize}>
                    {toMegabytes(apkProgress.written)} / {toMegabytes(apkProgress.total)} MB
                  </Text>
                )}
              </View>
              <ProgressBar progress={apkProgress.percent / 100} thickness={6} glow />
              <Text style={styles.downloadHint}>{t("generalsettings.update_download_hint")}</Text>
            </View>
          </ComplexDialog>
        ))}
    </AppUpdateContext.Provider>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  notes: {
    gap: PADDING_MARGIN.xs,
    marginBottom: PADDING_MARGIN.sm,
  },
  note: {
    flexDirection: "row",
    gap: PADDING_MARGIN.sm,
  },
  noteText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 21,
  },
  // the wrapped lines stay under the text, not under the bullet
  noteLine: {
    flex: 1,
  },
  size: {
    marginTop: PADDING_MARGIN.sm,
    color: COLOR.textMuted,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    fontVariant: ["tabular-nums"],
  },
  download: {
    gap: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.xs,
  },
  downloadFigures: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  downloadPercent: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  downloadSize: {
    color: COLOR.textMuted,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    fontVariant: ["tabular-nums"],
  },
  downloadHint: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 18,
  },
});
