export function isTauri(): boolean {
  // Tauri 2 always injects its IPC internals (`__TAURI__` only exists with `withGlobalTauri`).
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
