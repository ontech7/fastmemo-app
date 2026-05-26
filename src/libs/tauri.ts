// Web/Tauri build. Mobile uses the no-op `tauri.native.ts` sibling, so
// `@tauri-apps/api` is never pulled into the React Native bundle.

/** True only inside a Tauri WebView (the low-level IPC bridge is always present). */
export const isTauri = typeof window !== "undefined" && "__TAURI_IPC__" in window;

/**
 * Tell the Rust side to close the splash window and reveal the main window.
 * No-op outside Tauri (plain web browser). Safe to call more than once.
 */
export async function closeTauriSplashscreen(): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    await invoke("close_splashscreen");
  } catch {
    // The Rust-side safety net reveals the main window anyway.
  }
}
