import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowDownTrayIcon from "react-native-heroicons/outline/ArrowDownTrayIcon";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import useNetInfo from "@/hooks/useNetInfo";
import { checkLatestAppVersion } from "@/libs/api/checkLatestVersion";
import { checkDesktopUpdate as checkSignedDesktopUpdate, installDesktopUpdate } from "@/libs/desktopUpdater";
import type { DesktopUpdate } from "@/libs/desktopUpdater";
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
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdate | null>(null);
  const [isDesktopPromptOpen, setIsDesktopPromptOpen] = useState(false);
  const desktopUpdateRef = useRef<DesktopUpdate | null>(null);
  const desktopCheckedRef = useRef(false);
  // An install runs once: a second one would download and swap the app again.
  const isInstallingRef = useRef(false);

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
    if (isInstallingRef.current) return true;
    const update = await checkSignedDesktopUpdate();
    // Each found update holds a resource on the Rust side until closed.
    desktopUpdateRef.current?.close().catch(() => {});
    desktopUpdateRef.current = update;
    setDesktopUpdate(update);
    setIsDesktopPromptOpen(update !== null);
    return update !== null;
  }, []);

  // Desktop: offer a found update once per launch, like the old built-in updater did (without its native dialog,
  // which could hang the app). A failed check (e.g. offline at launch) is retried on the next connection.
  useEffect(() => {
    if (!isTauri() || !isConnected || desktopCheckedRef.current) return;
    desktopCheckedRef.current = true;
    checkDesktopUpdate().catch(() => {
      desktopCheckedRef.current = false;
    });
  }, [isConnected, checkDesktopUpdate]);

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
  }, [desktopUpdate, releaseUrl, checkDesktopUpdate, t]);

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
          confirm={{ label: t("generalsettings.update_install"), handler: confirmDesktopUpdate }}
        />
      )}
    </AppUpdateContext.Provider>
  );
}
