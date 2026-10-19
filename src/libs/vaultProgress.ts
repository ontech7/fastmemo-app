/**
 * Ephemeral, in-memory progress signal for the data-proportional part of a
 * vault operation — re-encrypting and uploading every note/category under the
 * (new) DEK during setup / migration / reset.
 *
 * The PBKDF2 key derivation takes a fixed, short time and reports no progress;
 * the full sync's upload, however, scales with the number of notes and can
 * take several seconds, so its batches drive a determinate bar instead of a
 * blind spinner. Same pub/sub shape as [[vaultPrompt]] / vaultSession.
 *
 * getSnapshot returns the SAME object reference until a mutation replaces it, so
 * it is safe for useSyncExternalStore (no render loop).
 */

export interface VaultProgress {
  done: number;
  total: number;
}

let current: VaultProgress | null = null;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((l) => l());

export const getVaultProgress = (): VaultProgress | null => current;

export const subscribeVaultProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Start a determinate phase with a known item count. A total <= 0 shows nothing. */
export const beginVaultProgress = (total: number): void => {
  current = total > 0 ? { done: 0, total } : null;
  notify();
};

/** Set how far the phase is (e.g. from a batched upload). Starts one if none is active. */
export const setVaultProgress = (done: number, total: number): void => {
  current = total > 0 ? { done: Math.min(done, total), total } : null;
  notify();
};

/** End the phase and hide the bar. */
export const clearVaultProgress = (): void => {
  if (current === null) return;
  current = null;
  notify();
};
