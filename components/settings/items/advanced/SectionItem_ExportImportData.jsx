import React, { useState } from "react";
import * as Sentry from "@sentry/react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform } from "react-native";
import CryptoJS from "react-native-crypto-js";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { KeyboardController } from "react-native-keyboard-controller";
import { useDispatch, useStore } from "react-redux";

import { isSecretPassphraseCorrect, toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";
import { useRouter } from "@/hooks/useRouter";
import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SecretPassphraseDialog from "@/components/dialogs/SecretPassphraseDialog";

import { setCategories } from "../../../../slicers/categoriesSlice";
import { setNotes, setTrashedNotes } from "../../../../slicers/notesSlice";
import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_ExportImportData({ isLast }) {
  const { t } = useTranslation();

  const router = useRouter();

  const store = useStore();
  const state = store.getState();

  const dispatch = useDispatch();

  // @ts-ignore
  const allNotes = state.notes.items;
  // @ts-ignore
  const allTrashedNotes = state.notes.temporaryItems;
  // @ts-ignore
  const allCategories = state.categories.items;

  // @ts-ignore
  const webhook_exportData = state.settings.webhooks.exportData;
  // @ts-ignore
  const webhook_importData = state.settings.webhooks.importData;

  // @ts-ignore
  const isFingerprintEnabled = state.settings.isFingerprintEnabled;

  const [errorMessage, setErrorMessage] = useState(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [showImportExportDialog, setShowImportExportDialog] = useState(false);

  const [showImportSecretDialog, setShowImportSecretDialog] = useState(false);
  const [showExportSecretDialog, setShowExportSecretDialog] = useState(false);

  const exportDataIOS = async (secretPassphrase) => {
    try {
      const exportData = {
        notes: allNotes,
        trashedNotes: allTrashedNotes,
        categories: allCategories,
      };

      const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(exportData), secretPassphrase).toString();

      // create local file and share it
      const fileUri = FileSystem.cacheDirectory + `FastMemo_exportedData_${new Date().getTime()}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, encryptedData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        dialogTitle: "Save file",
        UTI: "text/plain",
        mimeType: "text/plain",
      });

      webhook(webhook_exportData, { action: "generic/export" });

      setShowSuccessDialog(true);
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage(error.message);
      setShowErrorDialog(true);
    }

    setShowExportSecretDialog(false);
  };

  const exportData = async (secretPassphrase) => {
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        return;
      }

      const exportData = {
        notes: allNotes,
        trashedNotes: allTrashedNotes,
        categories: allCategories,
      };

      const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(exportData), secretPassphrase).toString();

      let fileUri = await StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        `FastMemo_exportedData_${new Date().getTime()}.txt`,
        "text/plain"
      );

      await FileSystem.writeAsStringAsync(fileUri, encryptedData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      webhook(webhook_exportData, { action: "generic/export" });

      setShowSuccessDialog(true);
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage(error.message);
      setShowErrorDialog(true);
    }

    setShowExportSecretDialog(false);
  };

  const importData = async (secretPassphrase) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain" });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;

      const asset = await FileSystem.getInfoAsync(fileUri);

      if (!asset.exists) {
        return;
      }

      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const bytes = CryptoJS.AES.decrypt(content, secretPassphrase);

      if (!isSecretPassphraseCorrect(bytes)) {
        setErrorMessage(t("popup.passphrase_wrong"));
        setShowErrorDialog(true);
        return;
      }

      const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
      const importedData = JSON.parse(convertedBytes);

      dispatch(setNotes({ notes: importedData.notes }));
      dispatch(setTrashedNotes(importedData.trashedNotes));
      dispatch(setCategories({ categories: importedData.categories }));

      webhook(webhook_importData, { action: "generic/import" });

      setShowSuccessDialog(true);
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage(error.message);
      setShowErrorDialog(true);
    }

    setShowImportExportDialog(false);
  };

  return (
    <>
      <ConfirmOrCancelDialog
        open={showErrorDialog}
        title={t("error")}
        description={errorMessage}
        onConfirm={() => setShowErrorDialog(false)}
      />

      <ConfirmOrCancelDialog
        open={showSuccessDialog}
        title={t("report.messages.success.title")}
        description={t("popup.generic_success_description")}
        onConfirm={() => setShowSuccessDialog(false)}
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

          if (Platform.OS !== "ios") {
            exportData(passphrase);
          } else {
            exportDataIOS(passphrase);
          }

          setTimeout(() => {
            KeyboardController.dismiss();
            Keyboard.dismiss();
          }, 20);

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

          KeyboardController.dismiss();
          Keyboard.dismiss();

          setShowImportSecretDialog(false);
        }}
      />

      <SectionItemList isLast={isLast}>
        <SectionItemList_Text
          title={t("generalsettings.export_import_data")}
          onPress={() =>
            toggleWithSecret({
              router,
              isFingerprintEnabled,
              callback: () => setShowImportExportDialog(true),
            })
          }
        />
      </SectionItemList>
    </>
  );
}
