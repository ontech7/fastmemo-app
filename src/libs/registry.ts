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

/* UNLOCKED NOTE */

/**
 * The protected note the user has just unlocked to open it (a card tap, or reopening one already open): its screen opens it
 * once without asking again. Any other way to the screen (a link, a shortcut) asks for the code (LL-085).
 */
export function storeUnlockedNote(id: string): void {
  registry.set("unlockedNote", id);
}

/** Whether `id` was just unlocked: true once, then false. */
export function consumeUnlockedNote(id: string): boolean {
  if (registry.get("unlockedNote") !== id) return false;
  registry.delete("unlockedNote");
  return true;
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

/* VAULT RECOVERY KEY */

/** One-shot transport for a freshly generated recovery key to the display screen. */
export function storeVaultRecoveryKey(recoveryKey: string): void {
  registry.set("vaultRecoveryKey", recoveryKey);
}

export function retrieveVaultRecoveryKey(): string | null {
  const key = (registry.get("vaultRecoveryKey") as string) ?? null;
  if (key) registry.delete("vaultRecoveryKey");
  return key;
}

/* PENDING WRITES */

const pendingFlushes = new Set<() => void>();

/**
 * Work that must be committed before the app goes to the background or is closed, e.g. a note
 * editor's batch of not yet committed edits (see `flushOnExit`). Returns the unregister function.
 */
export function registerPendingFlush(flush: () => void): () => void {
  pendingFlushes.add(flush);
  return () => {
    pendingFlushes.delete(flush);
  };
}

export function flushPending(): void {
  pendingFlushes.forEach((flush) => flush());
}
