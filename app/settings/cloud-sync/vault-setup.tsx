import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingSpinner from "@/components/LoadingSpinner";
import { VaultBackupButton } from "@/components/vault/VaultBackupButton";
import {
  VaultButton,
  VaultDescription,
  VaultError,
  VaultInfoCard,
  VaultInput,
  VaultLabel,
  VaultScreen,
} from "@/components/vault/VaultScaffold";
import { configs } from "@/configs";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { storeVaultRecoveryKey } from "@/libs/registry";
import { initializeVault, migrateLegacyVault, recreateVault } from "@/libs/vaultManager";
import { yieldToUI } from "@/utils/ui";

const MIN_PASSPHRASE = 8;

/**
 * Set the vault passphrase for a brand-new vault ("create"), while upgrading
 * existing global-key data ("migrate"), or while replacing the vault during a
 * reset ("reset"). On success it hands off to the recovery-key screen, which
 * runs the connect continuation. The destructive part of a reset only happens
 * here, on submit — so backing out before this is a no-op.
 */
export default function VaultSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId, mode } = useLocalSearchParams<{ projectId: string; mode: "create" | "migrate" | "reset" }>();

  const isMigrate = mode === "migrate";
  const isReset = mode === "reset";

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
      const result = isMigrate
        ? await migrateLegacyVault(projectId!, passphrase, configs.cloud.secretKey)
        : isReset
          ? await recreateVault(projectId!, passphrase)
          : await initializeVault(projectId!, passphrase);

      if (!result) {
        // null = a cloud write failed (the underlying error is logged by
        // setElementInCloud/createVaultExclusive). Surface it for diagnosis.
        console.log(`vault setup (${mode ?? "create"}) returned null — cloud write failed`);
        setError(t("cloudsync.vault.error_generic"));
        setLoading(false);
        return;
      }

      storeVaultRecoveryKey(result.recoveryKey);
      router.replace("/settings/cloud-sync/vault-recovery");
    } catch (e) {
      console.log(`vault setup (${mode ?? "create"}) threw:`, e);
      setError(t("cloudsync.vault.error_generic"));
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingSpinner
        visible={loading}
        color={COLOR.accentSoft}
        text={t(isMigrate ? "cloudsync.vault.migrating" : "cloudsync.vault.creating")}
      />

      <VaultScreen title={t(isMigrate ? "cloudsync.vault.migrate_title" : "cloudsync.vault.setup_title")}>
        <VaultDescription>{t(isMigrate ? "cloudsync.vault.migrate_desc" : "cloudsync.vault.setup_desc")}</VaultDescription>

        <VaultInfoCard
          points={[
            t("cloudsync.vault.point_private"),
            t("cloudsync.vault.point_password"),
            t("cloudsync.vault.point_devices"),
            t("cloudsync.vault.point_norecover"),
          ]}
        />

        <VaultLabel>{t("cloudsync.vault.passphrase_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.passphrase_placeholder")}
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
