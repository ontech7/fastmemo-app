import type { Update } from "@tauri-apps/plugin-updater";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowDownTrayIcon from "react-native-heroicons/outline/ArrowDownTrayIcon";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import useNetInfo from "@/hooks/useNetInfo";
import { checkLatestAppVersion } from "@/libs/api/checkLatestVersion";
import { flushNow } from "@/libs/flushOnExit";
import { openUrl } from "@/utils/openUrl";
import { isTauri } from "@/utils/platform";
import { toast } from "@/utils/toast";
import { getCurrentAppVersion, isDesktopOrWeb, isNewerVersion, pickUpdateUrl } from "@/utils/version";

import { COLOR } from "@/constants/styles";

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
}

const AppUpdateContext = createContext<AppUpdateContextValue>({
  updateAvailable: false,
  releaseUrl: null,
  openUpdate: () => {},
  checkDesktopUpdate: async () => false,
});

/** Shared "an update is available" state, checked once for the whole app. */
export const useAppUpdate = () => useContext(AppUpdateContext);

export default function AppUpdateProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  // Desktop: the signed update the Tauri updater found, and whether its install prompt is showing.
  const [desktopUpdate, setDesktopUpdate] = useState<Update | null>(null);
  const [isDesktopPromptOpen, setIsDesktopPromptOpen] = useState(false);
  const desktopCheckedRef = useRef(false);

  const { isConnected } = useNetInfo();

  // Check the remote API for a newer version. Re-runs when connectivity is
  // (re)gained; silently no-ops on any failure (see checkLatestAppVersion).
  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;

    const checkLatest = async () => {
      const data = await checkLatestAppVersion();
      if (cancelled || !data) return;

      const latest = isDesktopOrWeb() ? data.desktop.version : data.mobile.version;
      const current = getCurrentAppVersion();

      if (isNewerVersion(current, latest)) {
        setReleaseUrl(data.releaseUrl);
      }
    };

    checkLatest();

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const checkDesktopUpdate = useCallback(async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    setDesktopUpdate(update);
    setIsDesktopPromptOpen(update !== null);
    return update !== null;
  }, []);

  // Desktop: offer a found update once per launch, like the old built-in updater did (without its native dialog,
  // which could hang the app).
  useEffect(() => {
    if (!isTauri() || !isConnected || desktopCheckedRef.current) return;
    desktopCheckedRef.current = true;
    checkDesktopUpdate().catch(() => {});
  }, [isConnected, checkDesktopUpdate]);

  const installDesktopUpdate = useCallback(async () => {
    setIsDesktopPromptOpen(false);
    if (!desktopUpdate) return;

    toast(t("generalsettings.update_installing"));
    try {
      // The installer can quit the app without the usual exit flush (Windows): write pending edits first.
      await flushNow();
      await desktopUpdate.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      toast(`${t("error")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [desktopUpdate, t]);

  const openUpdate = useCallback(() => {
    if (desktopUpdate) {
      setIsDesktopPromptOpen(true);
      return;
    }
    if (!releaseUrl) return;
    openUrl(pickUpdateUrl(releaseUrl));
  }, [desktopUpdate, releaseUrl]);

  return (
    <AppUpdateContext.Provider
      value={{
        updateAvailable: releaseUrl != null || desktopUpdate != null,
        releaseUrl,
        openUpdate,
        checkDesktopUpdate,
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
          confirm={{ label: t("confirm"), handler: installDesktopUpdate }}
        />
      )}
    </AppUpdateContext.Provider>
  );
}
