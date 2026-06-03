import { useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingSpinner from "@/components/LoadingSpinner";
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
import { changePassphrase } from "@/libs/vaultManager";
import { yieldToUI } from "@/utils/ui";
import { toast } from "@/utils/toast";

const MIN_PASSPHRASE = 8;

/**
 * Change the passphrase on an unlocked, connected device. The DEK is unchanged,
 * so other devices keep working and no notes are re-encrypted.
 */
export default function VaultChangeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (next.length < MIN_PASSPHRASE) {
      setError(t("cloudsync.vault.passphrase_too_short"));
      return;
    }
    if (next !== confirm) {
      setError(t("cloudsync.vault.passphrase_mismatch"));
      return;
    }

    setError(null);
    setLoading(true);
    await yieldToUI(); // paint the spinner before the synchronous PBKDF2 freeze

    try {
      const ok = await changePassphrase(current, next);
      if (!ok) {
        setError(t("cloudsync.vault.wrong_passphrase"));
        setLoading(false);
        return;
      }

      toast(t("cloudsync.vault.change_success"));
      router.back();
    } catch {
      setError(t("cloudsync.vault.error_generic"));
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingSpinner visible={loading} color={COLOR.accentSoft} text={t("cloudsync.vault.saving")} />

      <VaultScreen title={t("cloudsync.vault.change_title")}>
        <VaultDescription>{t("cloudsync.vault.change_desc")}</VaultDescription>

        <VaultLabel>{t("cloudsync.vault.current_passphrase_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.current_passphrase_placeholder")}
          value={current}
          onChangeText={setCurrent}
        />

        <VaultLabel>{t("cloudsync.vault.new_passphrase_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.new_passphrase_placeholder")}
          value={next}
          onChangeText={setNext}
        />

        <VaultLabel>{t("cloudsync.vault.passphrase_confirm_placeholder")}</VaultLabel>
        <VaultInput
          secureTextEntry
          placeholder={t("cloudsync.vault.passphrase_confirm_placeholder")}
          value={confirm}
          onChangeText={setConfirm}
        />

        <VaultError message={error} />

        <VaultButton label={t("cloudsync.vault.change_action")} onPress={submit} disabled={loading} />
      </VaultScreen>
    </>
  );
}
