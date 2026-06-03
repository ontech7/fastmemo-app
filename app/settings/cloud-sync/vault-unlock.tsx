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
  VaultLink,
  VaultScreen,
} from "@/components/vault/VaultScaffold";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { useVaultProgress } from "@/hooks/useVaultProgress";
import { retrieveVaultContinuation } from "@/libs/registry";
import { unlockWithPassphrase } from "@/libs/vaultManager";
import { yieldToUI } from "@/utils/ui";

/**
 * Unlock an existing vault on this device (new device joining, reconnect, or a
 * connected device whose cached DEK was lost). On success it runs the stored
 * connect continuation (finalize connection / resync) and returns.
 */
export default function VaultUnlockScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const progress = useVaultProgress();

  const submit = async () => {
    if (!passphrase) return;

    setError(null);
    setLoading(true);
    await yieldToUI(); // paint the spinner before the synchronous PBKDF2 freeze

    try {
      const ok = await unlockWithPassphrase(projectId!, passphrase);
      if (!ok) {
        setError(t("cloudsync.vault.wrong_passphrase"));
        setLoading(false);
        return;
      }

      const continuation = retrieveVaultContinuation();
      if (continuation) await continuation();

      router.back();
    } catch {
      setError(t("cloudsync.vault.error_generic"));
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingSpinner
        visible={loading}
        color={COLOR.accentSoft}
        text={t(progress ? "cloudsync.vault.uploading" : "cloudsync.vault.unlocking")}
        progress={progress}
      />

      <VaultScreen title={t("cloudsync.vault.unlock_title")}>
        <VaultDescription>{t("cloudsync.vault.unlock_desc")}</VaultDescription>

        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.passphrase_placeholder")}
          value={passphrase}
          onChangeText={setPassphrase}
          onSubmitEditing={submit}
        />

        <VaultError message={error} />

        <VaultBackupButton />

        <VaultButton label={t("cloudsync.vault.unlock_action")} onPress={submit} disabled={loading} />

        <VaultLink
          label={t("cloudsync.vault.forgot_passphrase")}
          onPress={() => router.replace({ pathname: "/settings/cloud-sync/vault-recover", params: { projectId } })}
        />
      </VaultScreen>
    </>
  );
}
