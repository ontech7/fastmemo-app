import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingSpinner from "@/components/LoadingSpinner";
import { VaultBackupButton } from "@/components/vault/VaultBackupButton";
import {
  VaultButton,
  VaultDescription,
  VaultError,
  VaultInput,
  VaultLabel,
  VaultScreen,
} from "@/components/vault/VaultScaffold";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { storeVaultRecoveryKey } from "@/libs/registry";
import { recoverWithRecoveryKey } from "@/libs/vaultManager";
import { yieldToUI } from "@/utils/ui";

const MIN_PASSPHRASE = 8;

/**
 * Forgot-passphrase recovery: enter the recovery key and choose a new
 * passphrase. The DEK is recovered and re-wrapped, and a fresh recovery key is
 * issued (shown on the next screen, which also runs the connect continuation).
 */
export default function VaultRecoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [recoveryKey, setRecoveryKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (passphrase.length < MIN_PASSPHRASE) {
      setError(t("cloudsync.vault.passphrase_too_short"));
      return;
    }
    if (passphrase !== confirm) {
      setError(t("cloudsync.vault.passphrase_mismatch"));
      return;
    }

    setError(null);
    setLoading(true);
    await yieldToUI(); // paint the spinner before the synchronous PBKDF2 freeze

    try {
      const result = await recoverWithRecoveryKey(projectId!, recoveryKey, passphrase);
      if (!result) {
        setError(t("cloudsync.vault.wrong_recovery_key"));
        setLoading(false);
        return;
      }

      storeVaultRecoveryKey(result.recoveryKey);
      router.replace("/settings/cloud-sync/vault-recovery");
    } catch {
      setError(t("cloudsync.vault.error_generic"));
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingSpinner visible={loading} color={COLOR.accentSoft} text={t("cloudsync.vault.unlocking")} />

      <VaultScreen title={t("cloudsync.vault.recover_title")}>
        <VaultDescription>{t("cloudsync.vault.recover_desc")}</VaultDescription>

        <VaultLabel>{t("cloudsync.vault.recovery_key_placeholder")}</VaultLabel>
        <VaultInput
          autoCapitalize="characters"
          placeholder={t("cloudsync.vault.recovery_key_placeholder")}
          value={recoveryKey}
          onChangeText={setRecoveryKey}
        />

        <VaultLabel>{t("cloudsync.vault.new_passphrase_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.new_passphrase_placeholder")}
          value={passphrase}
          onChangeText={setPassphrase}
        />

        <VaultLabel>{t("cloudsync.vault.passphrase_confirm_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.passphrase_confirm_placeholder")}
          value={confirm}
          onChangeText={setConfirm}
        />

        <VaultError message={error} />

        <VaultBackupButton />

        <VaultButton label={t("cloudsync.vault.continue")} onPress={submit} disabled={loading} />
      </VaultScreen>
    </>
  );
}
