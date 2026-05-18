import { useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import { storeSecretCodeCallback } from "@/libs/registry";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";

type CallbackFn =
  | ((router: ReturnType<typeof useRouter>) => any | Promise<any>)
  | ((router: ReturnType<typeof useRouter>, isFingerprint: boolean) => any | Promise<any>)
  | (() => any | Promise<any>);

type DoNextType = "goBack" | "reload" | "dismissAll" | "none" | CallbackFn;

/**
 * Web variant: fingerprint authentication is never available, so
 * \`expo-local-authentication\` is never imported. The secret-code prompt path
 * is the only unlock flow on web/desktop.
 */
export const useSecret = () => {
  const router = useRouter();
  const isFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const unlockWithSecret = (callback: CallbackFn, doNext: DoNextType = "goBack") => {
    const isFingerprint = false;

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
  };

  return { unlockWithSecret, isFingerprintEnabled };
};
