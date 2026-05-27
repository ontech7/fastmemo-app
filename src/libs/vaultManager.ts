import type { Note } from "@/types";

import {
  COLLECTIONS,
  createVaultExclusive,
  deleteCollectionInCloud,
  getAllElementsInCloud,
  getVault,
  readVault,
  setElementInCloud,
  setVault,
} from "@/libs/firebase";
import { getDEK, loadPersistedDEK, persistDEK, wipePersistedDEK } from "@/libs/vaultSession";
import { CryptNote, tryDecryptNote } from "@/utils/crypt";
import {
  createVault,
  rewrapRecovery,
  rewrapWithNewPassphrase,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
  type VaultDoc,
} from "@/utils/vault";

/**
 * Orchestration for the per-vault E2E lifecycle. Pure-ish async operations the
 * UI / connect flow call; they touch Firestore and the device's vault session,
 * but contain no navigation. Each function maps to one of the connect cases:
 *
 *  - absent vault, no notes      -> initializeVault       (first device ever)
 *  - absent vault, legacy notes  -> migrateLegacyVault    (existing global-key data)
 *  - present vault               -> unlockWithPassphrase  (new device / reconnect / all-disconnected-then-new)
 *  - forgot passphrase           -> recoverWithRecoveryKey
 *  - rotate passphrase           -> changePassphrase
 *  - app restart                 -> restoreVaultSession   (re-load cached DEK before sync)
 *  - disconnect                  -> forgetDeviceVault     (drop cached DEK, keep cloud vault)
 *  - lost passphrase AND key     -> recreateVault         (replace vault + new passphrase, deferred until submit)
 *
 * Crucially the cloud vault document is NEVER deleted on a normal disconnect, so
 * "all devices disconnect, then a new device connects" is just the normal
 * unlock path against the still-present vault.
 */

export type VaultPresence = "absent" | "present" | "error";

export interface VaultProbe {
  presence: VaultPresence;
  vault: VaultDoc | null;
  /** True when the project holds notes but no vault yet — legacy data to migrate. */
  needsMigration: boolean;
}

/**
 * Inspect the connected project to decide which connect path to take. Returns
 * "error" when the vault status cannot be read (offline / transient) so callers
 * never fall through to creating a vault over one that actually exists.
 */
export const probeVault = async (): Promise<VaultProbe> => {
  const { status, vault } = await readVault();
  if (status === "error") return { presence: "error", vault: null, needsMigration: false };
  if (status === "present") return { presence: "present", vault, needsMigration: false };

  const notes = await getAllElementsInCloud({ collection: COLLECTIONS.data.notes, queryConstraints: [] });
  return { presence: "absent", vault: null, needsMigration: notes.isPresent && notes.data.length > 0 };
};

export interface VaultInitResult {
  recoveryKey: string;
}

/**
 * First device: create a fresh vault, cache the DEK, return the recovery key.
 * Uses an atomic create that fails if a vault already exists, so a racing device
 * or a stale "absent" read can never overwrite an existing vault (which would
 * orphan every already-encrypted note).
 */
export const initializeVault = async (projectId: string, passphrase: string): Promise<VaultInitResult | null> => {
  const { vault, dek, recoveryKey } = createVault(passphrase);

  const result = await createVaultExclusive(vault);
  if (result !== "created") return null; // "exists" (race -> unlock instead) or "error" -> don't proceed

  await persistDEK(projectId, dek);
  return { recoveryKey };
};

/**
 * Existing global-key data: create a new per-vault DEK and re-encrypt every
 * cloud note (decrypt with the legacy key, re-encrypt with the DEK) so nothing
 * is lost, then publish the vault doc. The legacy key is supplied by the caller
 * (the build-time SECRET_KEY) to keep this module independent of configs.
 */
export const migrateLegacyVault = async (
  projectId: string,
  passphrase: string,
  legacyKey: string
): Promise<VaultInitResult | null> => {
  const { vault, dek, recoveryKey } = createVault(passphrase);

  // Claim the vault FIRST (atomically). If this succeeds, presence flips to
  // "present", so any interruption/retry/other device takes the safe unlock
  // path instead of re-running migration over partially re-encrypted data.
  const result = await createVaultExclusive(vault);
  if (result !== "created") return null; // raced / unverifiable -> abort, route to unlock
  await persistDEK(projectId, dek);

  // Non-destructive sweep: re-encrypt only notes we can actually read, and never
  // overwrite a note we can't decrypt (that would turn it into garbage forever).
  // Notes that live on this device are also re-uploaded from local plaintext by
  // the full sync that runs right after, so this mainly covers cloud-only notes.
  const res = await getAllElementsInCloud({ collection: COLLECTIONS.data.notes, queryConstraints: [] });
  if (res.isPresent) {
    for (const raw of res.data) {
      const note = raw as Note;

      // Already migrated (carries our auth marker) -> leave it. This check is
      // reliable thanks to the marker, so we never re-process a DEK note.
      if (tryDecryptNote(note, dek) !== null) continue;

      // Read the legacy note leniently (legacy notes predate the marker). The
      // legacy key is the app's old global key (`configs.cloud.secretKey`), which
      // on this app has ALWAYS resolved to "" at runtime: SECRET_KEY lacks the
      // EXPO_PUBLIC_ prefix, so the Expo bundler strips it from the client bundle
      // and it never reached the encrypt path — every pre-vault note was AES-sealed
      // with "". So "" is the genuine (and only) legacy key, and decrypting with it
      // is as reliable as the pre-vault app's own decryption. We deliberately do
      // NOT skip on an empty key: that guard dropped every real legacy note,
      // making them vanish after migration (see LL-028).
      const plain = CryptNote.decrypt(note, legacyKey);

      await setElementInCloud({
        collection: COLLECTIONS.data.notes,
        identifier: note.id,
        payload: CryptNote.encrypt(plain, dek),
        noUpdateLastSync: true,
      });
    }
  }

  return { recoveryKey };
};

/** New device / reconnect: unlock the existing vault with the passphrase. Caches the DEK on success. */
export const unlockWithPassphrase = async (projectId: string, passphrase: string): Promise<boolean> => {
  const vault = await getVault();
  if (!vault) return false;

  const dek = unlockVaultWithPassphrase(vault, passphrase);
  if (!dek) return false;

  await persistDEK(projectId, dek);
  return true;
};

/** Forgot the passphrase: recover via the recovery key, set a new passphrase, and rotate the recovery key. */
export const recoverWithRecoveryKey = async (
  projectId: string,
  recoveryKey: string,
  newPassphrase: string
): Promise<VaultInitResult | null> => {
  const vault = await getVault();
  if (!vault) return null;

  const dek = unlockVaultWithRecoveryKey(vault, recoveryKey);
  if (!dek) return null; // wrong recovery key

  const rewrapped = rewrapWithNewPassphrase(vault, dek, newPassphrase);
  const { vault: rotated, recoveryKey: nextRecoveryKey } = rewrapRecovery(rewrapped, dek);

  // The key WAS valid; a write failure here must not look like "wrong key".
  // Throw so the UI shows a generic retry error instead, and the vault stays as-is.
  const ok = await setVault(rotated);
  if (!ok) throw new Error("vault write failed");

  await persistDEK(projectId, dek);
  return { recoveryKey: nextRecoveryKey };
};

/**
 * Rotate the passphrase. Requires the vault to be unlocked (DEK in session) and
 * the current passphrase to verify. The DEK is unchanged, so no note is
 * re-encrypted and other devices that cached the DEK keep working.
 */
export const changePassphrase = async (currentPassphrase: string, newPassphrase: string): Promise<boolean> => {
  const dek = getDEK();
  if (!dek) return false;

  const vault = await getVault();
  if (!vault) return false;

  // confirm the current passphrase really maps to the active DEK before rotating
  if (unlockVaultWithPassphrase(vault, currentPassphrase) !== dek) return false; // wrong current passphrase

  const rewrapped = rewrapWithNewPassphrase(vault, dek, newPassphrase);

  // current passphrase WAS correct; a write failure must not read as "wrong
  // password" — throw so the UI shows a generic retry error, vault unchanged.
  const ok = await setVault(rewrapped);
  if (!ok) throw new Error("vault write failed");
  return true;
};

/** At startup: re-load this device's cached DEK into the session before sync runs. */
export const restoreVaultSession = async (projectId: string): Promise<boolean> => {
  const dek = await loadPersistedDEK(projectId);
  return !!dek;
};

/** Disconnect this device: drop the cached DEK locally; the cloud vault is left intact. */
export const forgetDeviceVault = async (projectId: string): Promise<void> => {
  await wipePersistedDEK(projectId);
};

/**
 * Last-resort reset (passphrase and recovery key both lost): create a fresh
 * vault with a NEW passphrase, REPLACING the old one, then drop the old cloud
 * notes (they're sealed with the now-unrecoverable old DEK). Local notes are
 * untouched and re-uploaded under the new DEK by the sync that runs right after.
 *
 * Crucially, nothing destructive happens until the user has committed to a new
 * passphrase (this runs on the new-password submit), so backing out of the reset
 * is a no-op — the existing vault and notes stay intact.
 */
export const recreateVault = async (projectId: string, passphrase: string): Promise<VaultInitResult | null> => {
  const { vault, dek, recoveryKey } = createVault(passphrase);

  // Overwrite (not exclusive): a reset deliberately replaces the existing vault.
  const ok = await setVault(vault);
  if (!ok) return null;

  await persistDEK(projectId, dek);

  // Old notes are encrypted under the lost DEK — unrecoverable dead data. Drop
  // them; the continuation re-uploads this device's local notes under the new DEK.
  await deleteCollectionInCloud(COLLECTIONS.data.notes);

  return { recoveryKey };
};
