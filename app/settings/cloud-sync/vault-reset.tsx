import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { VaultBackupButton } from "@/components/vault/VaultBackupButton";
import { VaultButton, VaultDescription, VaultScreen } from "@/components/vault/VaultScaffold";
import { useRouter } from "@/hooks/useRouter";

/**
 * Last-resort reset for when both passphrase and recovery key are lost. This
 * screen only CONFIRMS intent — it destroys nothing. The user is sent to set a
 * new passphrase, and the cloud vault/notes are replaced only on that submit
 * (see recreateVault). Backing out here leaves the existing vault and notes intact.
 */
export default function VaultResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const confirm = () => {
    router.replace({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "reset" } });
  };

  return (
    <VaultScreen title={t("cloudsync.vault.reset_title")}>
      <VaultDescription>{t("cloudsync.vault.reset_desc")}</VaultDescription>

      <VaultBackupButton />

      <VaultButton label={t("cloudsync.vault.reset_action")} onPress={confirm} danger />
    </VaultScreen>
  );
}
