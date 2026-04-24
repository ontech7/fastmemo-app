import { isTauri } from "@/utils/platform";

/**
 * Web / Tauri variant of the encrypted-data IO module used by the
 * \`useExportImport\` hook. Browser uses a Blob + <a download> for export and a
 * hidden \`<input type="file">\` for import; Tauri uses the native save/open
 * dialogs via \`@tauri-apps/api\`.
 */

export async function exportEncryptedData(encryptedData: string, defaultFilename: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/api/dialog");
    const { writeTextFile } = await import("@tauri-apps/api/fs");

    const filePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });

    if (!filePath) return false;

    await writeTextFile(filePath, encryptedData);
    return true;
  }

  const blob = new Blob([encryptedData], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

export async function importEncryptedData(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/api/dialog");
    const { readTextFile } = await import("@tauri-apps/api/fs");

    const filePath = await open({
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      multiple: false,
    });

    if (!filePath || typeof filePath !== "string") {
      return null;
    }

    return readTextFile(filePath);
  }

  return new Promise<string | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const content = await file.text();
      resolve(content);
    };

    input.click();
  });
}
