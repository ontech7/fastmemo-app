import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const CHECK_INTERVAL = 30000; // 30 seconds

const useNetInfo = () => {
  const [netInfo, setNetInfo] = useState({
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

      setNetInfo({ isConnected: true, type: "wifi" });
    } catch {
      setNetInfo({ isConnected: false, type: "none" });
    }
  }, []);

  useEffect(() => {
    if (isTauri || Platform.OS === "web") {
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

      const unsubscribe = NetInfo.addEventListener((state) => {
        setNetInfo({
          isConnected: state.isConnected,
          type: state.type,
        });
      });

      return () => unsubscribe();
    }
  }, [checkConnectivity]);

  return netInfo;
};

export default useNetInfo;
