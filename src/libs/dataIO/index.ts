import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Native variant of the encrypted-data IO module used by the
 * \`useExportImport\` hook. Android uses the Storage Access Framework to let
 * the user pick a destination directory; iOS falls back to the share sheet.
 * Web has its own \`.web.ts\` variant that uses \`<input>\` / Tauri dialogs.
 */

export async function exportEncryptedData(encryptedData: string, defaultFilename: string): Promise<boolean> {
  if (Platform.OS === "ios") {
    // create local file and share it
    const fileUri = FileSystem.cacheDirectory + defaultFilename;
    await FileSystem.writeAsStringAsync(fileUri, encryptedData, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(fileUri, {
      dialogTitle: "Save file",
      UTI: "text/plain",
      mimeType: "text/plain",
    });

    return true;
  }

  const { StorageAccessFramework } = FileSystem;
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permissions.granted) {
    return false;
  }

  const fileUri = await StorageAccessFramework.createFileAsync(permissions.directoryUri, defaultFilename, "text/plain");

  await FileSystem.writeAsStringAsync(fileUri, encryptedData, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return true;
}

export async function importEncryptedData(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "text/plain" });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const fileUri = result.assets[0].uri;
  const asset = await FileSystem.getInfoAsync(fileUri);

  if (!asset.exists) {
    return null;
  }

  return FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
