/**
 * Ephemeral, in-memory signal for "the cloud is connected but encryption needs
 * the user's attention" (no cached DEK on this device — they must unlock or set
 * it up). It drives a startup dialog instead of a missable toast, because sync
 * stays paused until the user acts.
 *
 * Not persisted: it's re-derived each launch by SyncOnProvider after trying to
 * restore the DEK, and cleared once the vault is unlocked or the user dismisses it.
 */

let needed = false;
const listeners = new Set<() => void>();

export const getVaultPromptNeeded = (): boolean => needed;

export const setVaultPromptNeeded = (value: boolean): void => {
  if (needed === value) return;
  needed = value;
  listeners.forEach((l) => l());
};

export const subscribeVaultPrompt = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
