/**
 * Ephemeral, in-memory progress signal for the data-proportional part of a
 * vault operation — re-encrypting and uploading every note/category under the
 * (new) DEK during setup / migration / reset.
 *
 * The PBKDF2 key derivation is a synchronous freeze and cannot report progress;
 * the per-item upload loop, however, scales with the number of notes and can
 * take several seconds, so it drives a determinate bar instead of a blind
 * spinner. Same pub/sub shape as [[vaultPrompt]] / vaultSession.
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

/** Advance by one processed item (clamped to total). No-op if no phase is active. */
export const tickVaultProgress = (): void => {
  if (!current) return;
  current = { done: Math.min(current.done + 1, current.total), total: current.total };
  notify();
};

/** End the phase and hide the bar. */
export const clearVaultProgress = (): void => {
  if (current === null) return;
  current = null;
  notify();
};
