import React, { useState } from "react";
import * as Sentry from "@sentry/react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import CryptoJS from "react-native-crypto-js";
import { useDispatch, useStore } from "react-redux";

import { popupAlert } from "@/utils/alert";
import { isSecretPassphraseCorrect, toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";

import { setCategories } from "../../../../slicers/categoriesSlice";
import { setNotes, setTrashedNotes } from "../../../../slicers/notesSlice";
import SecretPassphraseDialog from "../../../SecretPassphraseDialog";
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

  const [secretImportVisible, setSecretImportVisible] = useState(false);
  const [secretExportVisible, setSecretExportVisible] = useState(false);

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
    } catch (error) {
      Sentry.captureException(error);
      popupAlert(t("error"), error.message, {
        confirmText: t("retry"),
        confirmHandler: () => {},
      });
    }

    setSecretExportVisible(false);
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
    } catch (error) {
      Sentry.captureException(error);
      popupAlert(t("error"), error.message, {
        confirmText: t("retry"),
        confirmHandler: () => {},
      });
    }

    setSecretExportVisible(false);
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
        popupAlert(t("error"), t("popup.passphrase_wrong"), {
          confirmText: t("retry"),
          confirmHandler: () => {},
        });
        return;
      }

      const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
      const importedData = JSON.parse(convertedBytes);

      dispatch(setNotes({ notes: importedData.notes }));
      dispatch(setTrashedNotes(importedData.trashedNotes));
      dispatch(setCategories({ categories: importedData.categories }));

      webhook(webhook_importData, { action: "generic/import" });
    } catch (error) {
      Sentry.captureException(error);
      popupAlert(t("error"), error.message, {
        confirmText: t("retry"),
        confirmHandler: () => {},
      });
    }

    setSecretImportVisible(false);
  };

  const importExportData = () => {
    popupAlert(
      t("warning"),
      t("popup.select_one_option"),
      {
        confirmText: t("import"),
        confirmHandler: () => setSecretImportVisible(true),
      },
      {
        alternateText: t("export"),
        alternateHandler: () => setSecretExportVisible(true),
      }
    );
  };

  const importExportDataWithSecret = () => {
    toggleWithSecret({
      router,
      isFingerprintEnabled,
      callback: importExportData,
    });
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text title={t("generalsettings.export_import_data")} onPress={importExportDataWithSecret} />

      <SecretPassphraseDialog
        title={t("generalsettings.export_import_popup_title")}
        description={t("generalsettings.export_popup_description")}
        visible={secretExportVisible}
        setVisible={setSecretExportVisible}
        onSetSecretPassphrase={Platform.OS !== "ios" ? exportData : exportDataIOS}
      />

      <SecretPassphraseDialog
        title={t("generalsettings.export_import_popup_title")}
        description={t("generalsettings.import_popup_description")}
        visible={secretImportVisible}
        setVisible={setSecretImportVisible}
        onSetSecretPassphrase={importData}
      />
    </SectionItemList>
  );
}
