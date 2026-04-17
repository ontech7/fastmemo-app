import { isTauri } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

const CHECK_INTERVAL = 30000; // 30 seconds

interface NetInfoState {
  isConnected: boolean;
  type: string;
}

const useNetInfo = (): NetInfoState => {
  const [netInfo, setNetInfo] = useState<NetInfoState>({
    isConnected: true,
    type: "unknown",
  });

  const checkConnectivity = useCallback(async () => {
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      });

      setNetInfo((prev) => (prev.isConnected && prev.type === "wifi" ? prev : { isConnected: true, type: "wifi" }));
    } catch {
      setNetInfo((prev) => (!prev.isConnected && prev.type === "none" ? prev : { isConnected: false, type: "none" }));
    }
  }, []);

  useEffect(() => {
    if (isTauri() || Platform.OS === "web") {
      checkConnectivity();

      const interval = setInterval(checkConnectivity, CHECK_INTERVAL);

      const handleOnline = () => checkConnectivity();
      const handleOffline = () => setNetInfo({ isConnected: false, type: "none" });

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        clearInterval(interval);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    } else {
      const NetInfo = require("@react-native-community/netinfo");

      const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        setNetInfo((prev) =>
          prev.isConnected === state.isConnected && prev.type === state.type
            ? prev
            : { isConnected: state.isConnected, type: state.type }
        );
      });

      return () => unsubscribe();
    }
  }, [checkConnectivity]);

  return netInfo;
};

export default useNetInfo;
