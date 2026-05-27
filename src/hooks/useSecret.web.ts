import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import { authenticateBiometric, isBiometricSupported } from "@/libs/biometric";
import { storeSecretCodeCallback } from "@/libs/registry";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";

type CallbackFn =
  | ((router: ReturnType<typeof useRouter>) => any | Promise<any>)
  | ((router: ReturnType<typeof useRouter>, isFingerprint: boolean) => any | Promise<any>)
  | (() => any | Promise<any>);

type DoNextType = "goBack" | "reload" | "dismissAll" | "none" | CallbackFn;

/**
 * Web/Tauri variant. In a plain browser fingerprint is never available, so the
 * secret-code prompt is the only unlock flow. Inside a Tauri WebView on
 * macOS/Windows, when fingerprint is enabled the OS biometric prompt is used
 * instead, falling back to the secret code if it is cancelled or fails.
 */
export const useSecret = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const isFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const promptSecretCode = (callback: CallbackFn, doNext: DoNextType, isFingerprint: boolean) => {
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

  const unlockWithSecret = (callback: CallbackFn, doNext: DoNextType = "goBack") => {
    if (isFingerprintEnabled && isBiometricSupported()) {
      authenticateBiometric(t("generalsettings.fingerprint_reason")).then((success) => {
        if (success) {
          // The biometric prompt is an overlay, not a pushed screen, so there
          // is nothing to navigate back from — mirror the native flow and just
          // run the callback. On failure, fall back to the secret-code screen.
          callback(router, true);
        } else {
          promptSecretCode(callback, doNext, false);
        }
      });
      return;
    }

    promptSecretCode(callback, doNext, false);
  };

  return { unlockWithSecret, isFingerprintEnabled };
};
