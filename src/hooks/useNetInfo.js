import { useEffect, useState } from "react";
import { Platform } from "react-native";

const useNetInfo = () => {
  const [netInfo, setNetInfo] = useState({
    isConnected: true,
    type: "unknown",
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleOnline = () => setNetInfo({ isConnected: true, type: "wifi" });
      const handleOffline = () => setNetInfo({ isConnected: false, type: "none" });

      setNetInfo({
        isConnected: navigator.onLine,
        type: navigator.onLine ? "wifi" : "none",
      });

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
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
  }, []);

  return netInfo;
};

export default useNetInfo;
