import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import useNetInfo from "@/hooks/useNetInfo";
import { checkLatestAppVersion } from "@/libs/api/checkLatestVersion";
import { openUrl } from "@/utils/openUrl";
import { getCurrentAppVersion, isDesktopOrWeb, isNewerVersion, pickUpdateUrl } from "@/utils/version";

interface AppUpdateContextValue {
  /** True when a newer app version is published for the current platform. */
  updateAvailable: boolean;
  /** Raw release URL from the API (platform-agnostic). */
  releaseUrl: string | null;
  /** Open the right update destination for the current platform. */
  openUpdate: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextValue>({
  updateAvailable: false,
  releaseUrl: null,
  openUpdate: () => {},
});

/** Shared "an update is available" state, checked once for the whole app. */
export const useAppUpdate = () => useContext(AppUpdateContext);

export default function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

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

  const openUpdate = useCallback(() => {
    if (!releaseUrl) return;
    openUrl(pickUpdateUrl(releaseUrl));
  }, [releaseUrl]);

  return (
    <AppUpdateContext.Provider value={{ updateAvailable: releaseUrl != null, releaseUrl, openUpdate }}>
      {children}
    </AppUpdateContext.Provider>
  );
}
