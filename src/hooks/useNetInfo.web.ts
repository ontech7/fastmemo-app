import { useEffect, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import { createNetStatus, type NetStatus, type NetStatusEnv } from "@/libs/netStatus";
import { getCloudConnected } from "@/slicers/settingsSlice";

const PROBE_URL = "https://www.gstatic.com/generate_204";
const PROBE_TIMEOUT_MS = 10_000;

const listen = (target: EventTarget, name: string) => (listener: () => void) => {
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
};

const browser: NetStatusEnv = {
  isOnline: () => navigator.onLine,
  isVisible: () => document.visibilityState === "visible",
  probe: async () => {
    // Not AbortSignal.timeout: WebKit before Safari 16 lacks it, and this module may load before its polyfill (libs/net).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(PROBE_URL, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  },
  onOnline: listen(window, "online"),
  onOffline: listen(window, "offline"),
  onVisibility: listen(document, "visibilitychange"),
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (handle) => window.clearInterval(handle as number),
};

/** One status for the whole app: every screen reading it shares the same events and the same timer (LL-082). */
const netStatus = createNetStatus(browser);

/** The connection status. The probe request runs only while a cloud is connected (to tell offline from unreachable). */
const useNetInfo = (): NetStatus => {
  const cloudConnected = useSelector(getCloudConnected);

  useEffect(() => (cloudConnected ? netStatus.retainProbe() : undefined), [cloudConnected]);

  return useSyncExternalStore(netStatus.subscribe, netStatus.getSnapshot, netStatus.getSnapshot);
};

export default useNetInfo;
