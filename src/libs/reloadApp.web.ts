/** Loads the app again from its root, not from the address that crashed (the crash screen's "Reopen"). */
export async function reloadApp(): Promise<void> {
  window.location.replace("/");
}
