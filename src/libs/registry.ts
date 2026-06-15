/*
 * Workaround for heavy params or non-serializable params
 */

const registry = new Map<string, unknown>();

/* NOTE - Dirty tracking */

export function storeDirtyNoteId(uuid: string): void {
  registry.set("dirtyNote", uuid);
}

export function retrieveDirtyNoteId(): string | null {
  const uuid = (registry.get("dirtyNote") as string) ?? null;

  if (uuid) {
    registry.delete("dirtyNote");
  }

  return uuid;
}

/* SECRET CODE */

export function storeSecretCodeCallback(callback: () => void): void {
  registry.set("secretCodeCallback", callback);
}

export function retrieveSecretCodeCallback(): (() => void) | undefined {
  return registry.get("secretCodeCallback") as (() => void) | undefined;
}

/* VAULT */

/** Continuation run after a successful unlock/init during the connect flow (finalize connection). */
export function storeVaultContinuation(callback: () => void | Promise<void>): void {
  registry.set("vaultContinuation", callback);
}

export function retrieveVaultContinuation(): (() => void | Promise<void>) | undefined {
  const cb = registry.get("vaultContinuation") as (() => void | Promise<void>) | undefined;
  if (cb) registry.delete("vaultContinuation");
  return cb;
}

/* SYNC */

/**
 * Manual "sync now" trigger registered by SyncOnProvider (which owns the sync
 * logic) so any screen — e.g. the Devices screen — can force a pull + push for
 * the current device when, rarely, automatic sync didn't fire. Persistent (not
 * one-shot): the latest registration stays until replaced.
 */
export function registerSyncNow(callback: () => Promise<void>): void {
  registry.set("syncNow", callback);
}

export function triggerSyncNow(): Promise<void> {
  const cb = registry.get("syncNow") as (() => Promise<void>) | undefined;
  return cb ? cb() : Promise.resolve();
}

/** One-shot transport for a freshly generated recovery key to the display screen. */
export function storeVaultRecoveryKey(recoveryKey: string): void {
  registry.set("vaultRecoveryKey", recoveryKey);
}

export function retrieveVaultRecoveryKey(): string | null {
  const key = (registry.get("vaultRecoveryKey") as string) ?? null;
  if (key) registry.delete("vaultRecoveryKey");
  return key;
}
