// Native build: the desktop updater only exists in the Tauri app (`desktopUpdater.web.ts`).

export interface DesktopUpdate {
  version: string;
  download(): Promise<void>;
  install(): Promise<void>;
  close(): Promise<void>;
}

export async function checkDesktopUpdate(): Promise<DesktopUpdate | null> {
  return null;
}

export async function installDesktopUpdate(_update: DesktopUpdate, _flush: () => Promise<void>): Promise<void> {}
