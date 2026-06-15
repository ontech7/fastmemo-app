import { secureStoreGet, secureStoreRemove, secureStoreSet } from "@/libs/secureStore";

/**
 * In-memory holder for the active vault DEK, plus per-device persistence.
 *
 * The DEK is the key `CryptNote` uses to encrypt/decrypt notes. It is held in
 * memory for the session and (when the user unlocks once per device) cached in
 * secure storage so it survives app restarts without re-entering the passphrase.
 *
 * The cache is namespaced by Firebase projectId, so switching to a different
 * Firebase project (a different vault) never reuses the wrong DEK, and the
 * "all devices disconnected, a new one connects" case starts clean.
 *
 * Because the DEK is unchanged by a passphrase change, a device that cached it
 * keeps working even after another device rotates the passphrase.
 */

let activeDEK: string | null = null;

const keyFor = (projectId: string): string => `vaultDEK_${projectId.replace(/[^\w.-]/g, "_")}`;

// Lightweight pub/sub so the UI can react to lock/unlock without a redux mirror.
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

/** Subscribe to lock/unlock changes (used by useVaultUnlocked via useSyncExternalStore). */
export const subscribeVault = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The active DEK, or null if the vault is locked / not yet unlocked this session. */
export const getDEK = (): string | null => activeDEK;

export const isVaultUnlocked = (): boolean => activeDEK !== null;

const apply = (dek: string | null): void => {
  const changed = activeDEK !== dek;
  activeDEK = dek;
  if (changed) notify();
};

/** Load the DEK into memory only (no persistence) — e.g. right after unlocking. */
export const setDEK = (dek: string): void => apply(dek);

/** Drop the in-memory DEK (does not touch the persisted copy). */
export const lockVault = (): void => apply(null);

/** Cache the DEK for this device so future launches unlock without the passphrase. */
export const persistDEK = async (projectId: string, dek: string): Promise<void> => {
  apply(dek);
  await secureStoreSet(keyFor(projectId), dek);
};

/** Restore a previously cached DEK into memory (called at startup before sync runs). */
export const loadPersistedDEK = async (projectId: string): Promise<string | null> => {
  const dek = await secureStoreGet(keyFor(projectId));
  if (dek) apply(dek);
  return dek;
};

/** Forget the DEK both in memory and on disk (disconnect / reset vault). */
export const wipePersistedDEK = async (projectId: string): Promise<void> => {
  apply(null);
  await secureStoreRemove(keyFor(projectId));
};
