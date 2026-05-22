import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform } from "react-native";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { KeyboardController } from "react-native-keyboard-controller";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SecretPassphraseDialog from "@/components/dialogs/SecretPassphraseDialog";
import SectionItemList_Text from "@/components/settings/components/item/SectionItemList_Text";
import SectionItemList from "@/components/settings/components/list/SectionItemList";
import { useExportImport } from "@/hooks/useExportImport";
import { useSecret } from "@/hooks/useSecret";

interface Props {
  isLast: boolean;
}

export default function SectionItem_ExportImportData({ isLast }: Props) {
  const { t } = useTranslation();

  const { unlockWithSecret } = useSecret();
  const { error, success, exportData, importData, dismissError, dismissSuccess } = useExportImport();

  const [showImportExportDialog, setShowImportExportDialog] = useState(false);
  const [showImportSecretDialog, setShowImportSecretDialog] = useState(false);
  const [showExportSecretDialog, setShowExportSecretDialog] = useState(false);

  const dismissKeyboard = () => {
    if (Platform.OS !== "web") {
      setTimeout(() => {
        KeyboardController.dismiss();
        Keyboard.dismiss();
      }, 20);
    }
  };

  return (
    <>
      <ConfirmOrCancelDialog open={!!error} title={t("error")} description={error} onConfirm={dismissError} />

      <ConfirmOrCancelDialog
        open={success}
        title={t("report.messages.success.title")}
        description={t("popup.generic_success_description")}
        onConfirm={dismissSuccess}
      />

      <ComplexDialog
        open={showImportExportDialog}
        adornmentStart={<ExclamationTriangleIcon size={22} style={{ marginBottom: -3 }} />}
        title={t("warning")}
        description={t("popup.select_one_option")}
        confirm={{
          label: t("import"),
          handler: () => {
            setShowImportExportDialog(false);
            setShowImportSecretDialog(true);
          },
        }}
        cancel={{
          label: t("export"),
          handler: () => {
            setShowImportExportDialog(false);
            setShowExportSecretDialog(true);
          },
        }}
        alternative={{
          label: t("cancel"),
          handler: () => setShowImportExportDialog(false),
        }}
      />

      <SecretPassphraseDialog
        open={showExportSecretDialog}
        title={t("generalsettings.export_import_popup_title")}
        description={t("generalsettings.export_popup_description")}
        onCancel={() => setShowExportSecretDialog(false)}
        onConfirm={(passphrase) => {
          if (!passphrase) {
            return;
          }

          exportData(passphrase);
          dismissKeyboard();

          setShowExportSecretDialog(false);
        }}
      />

      <SecretPassphraseDialog
        open={showImportSecretDialog}
        title={t("generalsettings.export_import_popup_title")}
        description={t("generalsettings.import_popup_description")}
        onCancel={() => setShowImportSecretDialog(false)}
        onConfirm={(passphrase) => {
          if (!passphrase) {
            return;
          }

          importData(passphrase);

          if (Platform.OS !== "web") {
            KeyboardController.dismiss();
            Keyboard.dismiss();
          }

          setShowImportSecretDialog(false);
        }}
      />

      <SectionItemList isLast={isLast}>
        <SectionItemList_Text
          title={t("generalsettings.export_import_data")}
          onPress={() => unlockWithSecret(() => setShowImportExportDialog(true))}
        />
      </SectionItemList>
    </>
  );
}
