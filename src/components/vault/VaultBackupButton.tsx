import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowDownTrayIcon } from "react-native-heroicons/outline";

import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SecretPassphraseDialog from "@/components/dialogs/SecretPassphraseDialog";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useExportImport } from "@/hooks/useExportImport";

/**
 * Optional "quick backup" prompt shown before a risky vault operation
 * (first-time setup, legacy migration, reset, or an unlock that triggers a
 * cloud->local resync). It reuses the same encrypted export as Settings ->
 * Advanced: it reads the LOCAL plaintext notes and writes a passphrase-encrypted
 * file, so it never touches the vault/cloud and keeps working even if encryption
 * later fails. Purely a safety net — the user takes it or skips it.
 */
export function VaultBackupButton() {
  const { t } = useTranslation();
  const { error, success, isWorking, exportData, dismissError, dismissSuccess } = useExportImport();
  const [showExportSecret, setShowExportSecret] = useState(false);

  return (
    <>
      <ConfirmOrCancelDialog open={!!error} title={t("error")} description={error} onConfirm={dismissError} />

      <ConfirmOrCancelDialog
        open={success}
        title={t("report.messages.success.title")}
        description={t("popup.generic_success_description")}
        onConfirm={dismissSuccess}
      />

      <SecretPassphraseDialog
        open={showExportSecret}
        title={t("generalsettings.export_import_popup_title")}
        description={t("generalsettings.export_popup_description")}
        onCancel={() => setShowExportSecret(false)}
        onConfirm={(passphrase) => {
          if (!passphrase) return;
          exportData(passphrase);
          setShowExportSecret(false);
        }}
      />

      <View style={styles.card}>
        <Text style={styles.hint}>{t("cloudsync.vault.backup_hint")}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isWorking}
          onPress={() => setShowExportSecret(true)}
          style={[styles.button, isWorking && styles.buttonDisabled]}
        >
          <ArrowDownTrayIcon size={18} color={COLOR.accentSoft} />
          <Text style={styles.buttonText}>{t("cloudsync.vault.backup_action")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
  },
  hint: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 20,
    marginBottom: PADDING_MARGIN.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accentSoft,
    backgroundColor: "transparent",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLOR.accentSoft, fontFamily: FONT.semiBold, fontSize: FONTSIZE.medium },
});
