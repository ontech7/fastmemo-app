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
 * macOS/Windows, when fingerprint is enabled the OS biometric prompt is the
 * only unlock path — like native, cancelling/failing it just aborts (no
 * secret-code fallback).
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
        // The biometric prompt is an overlay, not a pushed screen, so there is
        // nothing to navigate back from — mirror the native flow: run the
        // callback on success and do nothing on cancel/failure. With fingerprint
        // enabled that's the only unlock path, so there is no secret-code
        // fallback — cancelling simply aborts.
        if (success) callback(router, true);
      });
      return;
    }

    promptSecretCode(callback, doNext, false);
  };

  return { unlockWithSecret, isFingerprintEnabled };
};
