import * as Sentry from "@sentry/react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import CryptoJS from "react-native-crypto-js";
import { useDispatch, useStore } from "react-redux";

import { exportEncryptedData, importEncryptedData } from "@/libs/dataIO";
import { setCategories } from "@/slicers/categoriesSlice";
import { setNotes, setTrashedNotes } from "@/slicers/notesSlice";
import { isSecretPassphraseCorrect } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";

interface Result {
  error: string | null;
  success: boolean;
  isWorking: boolean;
  exportData: (secretPassphrase: string) => Promise<void>;
  importData: (secretPassphrase: string) => Promise<void>;
  dismissError: () => void;
  dismissSuccess: () => void;
}

/**
 * Platform-agnostic hook that encapsulates encrypted data export / import
 * logic. Uses \`@/libs/dataIO\` (file-based platform split) for the actual
 * file IO, so consumers do not need to branch on \`Platform.OS\`.
 */
export function useExportImport(): Result {
  const { t } = useTranslation();
  const store = useStore();
  const dispatch = useDispatch();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const exportData = useCallback(
    async (secretPassphrase: string) => {
      setIsWorking(true);
      try {
        const state = store.getState() as any;
        const payload = {
          notes: state.notes.items,
          trashedNotes: state.notes.temporaryItems,
          categories: state.categories.items,
        };

        const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(payload), secretPassphrase).toString();
        const defaultFilename = `FastMemo_exportedData_${new Date().getTime()}.txt`;

        const didWrite = await exportEncryptedData(encryptedData, defaultFilename);

        if (didWrite) {
          webhook(state.settings.webhooks.exportData, { action: "generic/export" });
          setSuccess(true);
        }
      } catch (e: unknown) {
        Sentry.captureException(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsWorking(false);
      }
    },
    [store]
  );

  const importData = useCallback(
    async (secretPassphrase: string) => {
      setIsWorking(true);
      try {
        const content = await importEncryptedData();
        if (content == null) {
          return;
        }

        const bytes = CryptoJS.AES.decrypt(content, secretPassphrase);

        if (!isSecretPassphraseCorrect(bytes)) {
          setError(t("popup.passphrase_wrong"));
          return;
        }

        const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
        const importedData = JSON.parse(convertedBytes);

        dispatch(setNotes({ notes: importedData.notes }));
        dispatch(setTrashedNotes(importedData.trashedNotes));
        dispatch(setCategories({ categories: importedData.categories }));

        const state = store.getState() as any;
        webhook(state.settings.webhooks.importData, { action: "generic/import" });

        setSuccess(true);
      } catch (e: unknown) {
        Sentry.captureException(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsWorking(false);
      }
    },
    [dispatch, store, t]
  );

  const dismissError = useCallback(() => setError(null), []);
  const dismissSuccess = useCallback(() => setSuccess(false), []);

  return { error, success, isWorking, exportData, importData, dismissError, dismissSuccess };
}
