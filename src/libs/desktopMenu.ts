// Native (iOS/Android) no-op: the menu bar is a desktop (Tauri, macOS) thing. The web build uses the `.web.ts` sibling.
export function installDesktopMenu(): void {
  // no-op
}
