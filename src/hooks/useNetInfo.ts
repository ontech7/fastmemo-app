import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

interface NetInfoState {
  isConnected: boolean;
  type: string;
}

const useNetInfo = (): NetInfoState => {
  const [netInfo, setNetInfo] = useState<NetInfoState>({
    isConnected: true,
    type: "unknown",
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetInfo((prev) =>
        prev.isConnected === !!state.isConnected && prev.type === state.type
          ? prev
          : { isConnected: !!state.isConnected, type: state.type }
      );
    });

    return () => unsubscribe();
  }, []);

  return netInfo;
};

export default useNetInfo;
