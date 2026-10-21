import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { usePreventRemove } from "expo-router";

import LoadingSpinner from "@/components/LoadingSpinner";
import { VaultButton, VaultDescription, VaultError, VaultScreen } from "@/components/vault/VaultScaffold";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { useVaultProgress } from "@/hooks/useVaultProgress";
import { retrieveVaultContinuation, retrieveVaultRecoveryKey } from "@/libs/registry";

/**
 * Show the recovery key exactly once (it is never stored anywhere we can read
 * back). Confirming runs the stored connect continuation and returns to the
 * cloud settings screen. Until then nothing leaves the screen (no back button,
 * no hardware or browser back): the key would be gone and the connection left
 * half-done. Once confirmed, a continuation that failed (offline) shows an error
 * and the screen may be left.
 */
export default function VaultRecoveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Read once on mount; the registry entry is consumed on retrieval.
  const [recoveryKey] = useState<string | null>(() => retrieveVaultRecoveryKey());
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const progress = useVaultProgress();
  const allowLeaving = usePreventRemove(!!recoveryKey && !confirmed);
  // Taken on the first confirm and kept: a retry after a failure runs it again.
  const continuation = useRef<(() => void | Promise<void>) | null>(null);

  // If reached without a key (e.g. a stale navigation), bail back gracefully.
  useEffect(() => {
    if (!recoveryKey) router.back();
  }, [recoveryKey, router]);

  // The continuation does a full sync (add device + upload/download), so it can
  // take a few seconds — show a spinner instead of an unresponsive button.
  const confirm = async () => {
    setConfirmed(true);
    allowLeaving();
    setFailed(false);
    setLoading(true);
    try {
      continuation.current ??= retrieveVaultContinuation() ?? null;
      if (continuation.current) await continuation.current();
      router.back();
    } catch {
      setFailed(true);
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingSpinner
        visible={loading}
        color={COLOR.accentSoft}
        text={t(progress ? "cloudsync.vault.uploading" : "cloudsync.vault.finishing")}
        progress={progress}
      />

      <VaultScreen
        title={t("cloudsync.vault.recovery_title")}
        back={confirmed}
        backShortcut={false}
        footer={<VaultButton label={t("cloudsync.vault.recovery_saved")} onPress={confirm} disabled={loading} />}
      >
        <VaultDescription>{t("cloudsync.vault.recovery_desc")}</VaultDescription>

        <View style={styles.keyBox}>
          <Text style={styles.keyText} selectable>
            {recoveryKey}
          </Text>
        </View>

        <VaultError message={failed ? t("cloudsync.vault.error_generic") : null} />
      </VaultScreen>
    </>
  );
}

const styles = StyleSheet.create({
  keyBox: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    paddingVertical: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.lg,
    alignItems: "center",
  },
  keyText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.intro,
    letterSpacing: 2,
    textAlign: "center",
  },
});
