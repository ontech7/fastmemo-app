import { storeSecretCodeCallback } from "@/libs/registry";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";
import { Platform } from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "./useRouter";

type CallbackFn =
  | ((router: ReturnType<typeof useRouter>) => any | Promise<any>)
  | ((router: ReturnType<typeof useRouter>, isFingerprint: boolean) => any | Promise<any>)
  | (() => any | Promise<any>);

type DoNextType = "goBack" | "reload" | "dismissAll" | "none" | CallbackFn;

export const useSecret = () => {
  const router = useRouter();
  const isFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const unlockWithSecret = (callback: CallbackFn, doNext: DoNextType = "goBack") => {
    const isFingerprint = Platform.OS !== "web" && isFingerprintEnabled;

    if (!isFingerprint) {
      storeSecretCodeCallback(() => {
        callback(router, isFingerprint);

        if (typeof doNext === "function") {
          doNext(router, isFingerprint);
        } else if (doNext === "goBack") {
          router.back();
        } else if (doNext === "reload") {
          router.reload();
        } else if (doNext === "dismissAll") {
          router.dismissAll();
        }
      });

      router.push({
        pathname: "/secret-code",
        params: {
          startPhase: "unlockCode",
        },
      });
      return;
    }

    const LocalAuthentication = require("expo-local-authentication");
    LocalAuthentication.authenticateAsync().then((authResult) => {
      if (authResult?.success) callback(router, isFingerprint);
    });
  };

  return { unlockWithSecret, isFingerprintEnabled };
};
