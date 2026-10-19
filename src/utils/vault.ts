import CryptoJS from "crypto-js";

import { randomBytes, randomBytesHex } from "@/utils/secureRandom";
import FastmemoCrypto from "~/modules/fastmemo-crypto";

/**
 * Per-vault end-to-end encryption primitives.
 *
 * Threat model: cloud data (Firestore) and the app bundle are both reachable by
 * an attacker, so the encryption key must live nowhere except in the user's head
 * (a passphrase) and, derived, in each device's secure storage. There is no
 * Firebase Auth — a Firebase project is a single "vault" shared by up to a few
 * devices, each connecting by manually entering the Firebase credentials. The
 * passphrase is, in effect, a 4th credential the user re-enters per device; it
 * is never written to Firestore.
 *
 * Envelope encryption:
 *  - DEK (Data Encryption Key): a random 256-bit key that encrypts every note.
 *    It NEVER changes for the life of the vault.
 *  - KEK (Key Encryption Key): derived from the passphrase via PBKDF2. It only
 *    wraps the DEK. Changing the passphrase re-wraps the DEK (one tiny write) —
 *    no note is ever re-encrypted, and devices that already cached the DEK keep
 *    working because the DEK is unchanged.
 *  - recovery key: an independently generated high-entropy key that wraps a
 *    second copy of the DEK, so a forgotten passphrase is recoverable without a
 *    wipe.
 *
 * Crypto choices and their constraints:
 *  - PBKDF2-SHA256 (KDF) runs natively (`modules/fastmemo-crypto`: the platform's
 *    HMAC on Android/iOS, WebCrypto on web/Tauri), off the JS thread: in pure JS
 *    it froze the app for seconds. Every implementation is byte-identical to
 *    crypto-js, which stays the fallback (no native module, no secure context)
 *    and the reference the native output is checked against on first use.
 *  - `crypto-js` (full, pure-JS, synchronous, identical on iOS/Android/web/Tauri)
 *    for AES (wrapping). It must be synchronous because note encryption runs
 *    inside Redux reducers; WebCrypto is async and absent on native RN, and a
 *    native GCM module would not run in the Tauri WebView.
 *  - secure randomness comes from `@/utils/secureRandom` (OS CSPRNG), never from
 *    CryptoJS's Math.random-backed WordArray.random.
 *  - passphrase correctness is verified deterministically via the canary, so a
 *    correct passphrase can never be wrongly rejected.
 *
 * Note: the actual note ciphertext (see `@/utils/crypt`) uses the DEK as the
 * AES passphrase via react-native-crypto-js; its OpenSSL output format is
 * byte-compatible with crypto-js, so notes round-trip across devices and the
 * legacy→v2 migration can decrypt old data and re-encrypt under the DEK.
 */

/** Bumped from the implicit v1 (global build-time SECRET_KEY) to the per-vault scheme. */
export const VAULT_VERSION = 2 as const;

/**
 * PBKDF2 iterations. This runs only at init/unlock/passphrase-change (never per
 * note, because the DEK is cached). Stored in the vault doc so future builds can
 * raise it without breaking old vaults — but every device must still derive it,
 * including old app versions that only have the slow pure-JS implementation.
 */
const DEFAULT_KDF_ITERATIONS = 100_000;

const DEK_BYTES = 32; // 256-bit data key
const SALT_BYTES = 16;
const RECOVERY_BYTES = 20; // 160-bit recovery key -> 32 Base32 chars
const KEK_BYTES = 32; // 256-bit derived key

/** Known plaintext sealed under the DEK; used to verify a candidate DEK is correct. */
const CANARY_PLAINTEXT = "fastmemo-vault-canary-v1";

/** Crockford Base32 alphabet (no I, L, O, U) — readable, transcription-safe recovery keys. */
const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface VaultKdf {
  algo: "PBKDF2";
  hash: "SHA256";
  iterations: number;
}

/**
 * The vault document stored in Firestore. None of these fields leak the
 * passphrase or the DEK in the clear: salt/recoverySalt are public by design,
 * and the wrapped/canary blobs are useless without the passphrase or recovery key.
 */
export interface VaultDoc {
  version: number;
  kdf: VaultKdf;
  /** Hex salt for the passphrase KEK. */
  salt: string;
  /** DEK encrypted under the passphrase-derived KEK. */
  wrappedDEK: string;
  /** CANARY_PLAINTEXT encrypted under the DEK — verifies a candidate DEK. */
  canary: string;
  /** Hex salt for the recovery-key KEK. */
  recoverySalt: string;
  /** DEK encrypted under the recovery-key-derived KEK. */
  wrappedDEKRecovery: string;
  createdAt: number;
  updatedAt: number;
}

/** Generate a fresh 256-bit DEK as a 64-char hex string (used as the CryptNote key). */
export const generateDEK = (): string => randomBytesHex(DEK_BYTES);

/** Generate a user-facing recovery key: Crockford Base32, grouped in 4s (e.g. AB12-CD34-...). */
export const generateRecoveryKey = (): string => {
  const bytes = randomBytes(RECOVERY_BYTES);

  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  // group in blocks of 4 for readability
  return out.match(/.{1,4}/g)?.join("-") ?? out;
};

/** Normalize a recovery key the user typed back in (strip spaces/dashes, uppercase). */
export const normalizeRecoveryKey = (recoveryKey: string): string => recoveryKey.replace(/[\s-]/g, "").toUpperCase();

const deriveKEKHexJs = (secret: string, saltHex: string, iterations: number, keyLength = KEK_BYTES): string => {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const key = CryptoJS.PBKDF2(secret, salt, {
    keySize: keyLength / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  return key.toString(CryptoJS.enc.Hex);
};

/**
 * Whether the native PBKDF2 can be trusted, decided once: it must reproduce crypto-js' output (a
 * cheap 2-iteration check, an accented and an empty passphrase), or a vault created on one platform
 * could not be unlocked on another.
 */
let nativeKdfVerified: Promise<boolean> | null = null;

const isNativeKdfUsable = (): Promise<boolean> => {
  nativeKdfVerified ??= (async () => {
    if (!FastmemoCrypto) return false;
    const saltHex = "00112233445566778899aabbccddeeff";
    try {
      for (const secret of ["pässwörd ✓ 密码", ""]) {
        const native = await FastmemoCrypto.pbkdf2Sha256Async(secret, saltHex, 2, KEK_BYTES);
        if (native !== deriveKEKHexJs(secret, saltHex, 2)) return false;
      }
      return true;
    } catch {
      return false;
    }
  })();
  return nativeKdfVerified;
};

const deriveKEKHex = async (secret: string, saltHex: string, iterations: number): Promise<string> => {
  if (await isNativeKdfUsable()) {
    try {
      return await FastmemoCrypto!.pbkdf2Sha256Async(secret, saltHex, iterations, KEK_BYTES);
    } catch {
      // fall through to the JS implementation
    }
  }
  return deriveKEKHexJs(secret, saltHex, iterations);
};

const aesEncrypt = (plaintext: string, keyStr: string): string => CryptoJS.AES.encrypt(plaintext, keyStr).toString();

const aesDecrypt = (blob: string, keyStr: string): string => {
  try {
    return CryptoJS.AES.decrypt(blob, keyStr).toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
};

/** A candidate DEK is correct iff it decrypts the canary back to the known plaintext. */
const isDEKValid = (vault: VaultDoc, dek: string): boolean => {
  try {
    return !!dek && aesDecrypt(vault.canary, dek) === CANARY_PLAINTEXT;
  } catch {
    return false;
  }
};

/**
 * Whether a cached DEK still matches the current cloud vault. Used by other
 * devices to detect that the vault was reset/replaced (new DEK) elsewhere: if
 * this returns false, the cached key is stale and the device must re-lock.
 */
export const dekMatchesVault = (vault: VaultDoc, dek: string): boolean => isDEKValid(vault, dek);

export interface CreatedVault {
  vault: VaultDoc;
  dek: string;
  recoveryKey: string;
}

/** Create a brand-new vault from a chosen passphrase. Returns the DEK to cache and the recovery key to show once. */
export const createVault = async (passphrase: string, iterations: number = DEFAULT_KDF_ITERATIONS): Promise<CreatedVault> => {
  const dek = generateDEK();
  const salt = randomBytesHex(SALT_BYTES);
  const recoverySalt = randomBytesHex(SALT_BYTES);
  const recoveryKey = generateRecoveryKey();

  const [kekHex, recoveryKekHex] = await Promise.all([
    deriveKEKHex(passphrase, salt, iterations),
    deriveKEKHex(normalizeRecoveryKey(recoveryKey), recoverySalt, iterations),
  ]);

  const now = Date.now();
  const vault: VaultDoc = {
    version: VAULT_VERSION,
    kdf: { algo: "PBKDF2", hash: "SHA256", iterations },
    salt,
    wrappedDEK: aesEncrypt(dek, kekHex),
    canary: aesEncrypt(CANARY_PLAINTEXT, dek),
    recoverySalt,
    wrappedDEKRecovery: aesEncrypt(dek, recoveryKekHex),
    createdAt: now,
    updatedAt: now,
  };

  return { vault, dek, recoveryKey };
};

/** Unlock with the passphrase. Returns the DEK or null if the passphrase is wrong. */
export const unlockVaultWithPassphrase = async (vault: VaultDoc, passphrase: string): Promise<string | null> => {
  const kekHex = await deriveKEKHex(passphrase, vault.salt, vault.kdf.iterations);
  const dek = aesDecrypt(vault.wrappedDEK, kekHex);
  return isDEKValid(vault, dek) ? dek : null;
};

/** Unlock with the recovery key. Returns the DEK or null if the recovery key is wrong. */
export const unlockVaultWithRecoveryKey = async (vault: VaultDoc, recoveryKey: string): Promise<string | null> => {
  const kekHex = await deriveKEKHex(normalizeRecoveryKey(recoveryKey), vault.recoverySalt, vault.kdf.iterations);
  const dek = aesDecrypt(vault.wrappedDEKRecovery, kekHex);
  return isDEKValid(vault, dek) ? dek : null;
};

/**
 * Re-wrap the existing DEK under a new passphrase. The DEK is unchanged, so no
 * note is re-encrypted and already-unlocked devices keep working untouched.
 * Caller must hold a valid DEK (i.e. be unlocked) before calling this.
 */
export const rewrapWithNewPassphrase = async (vault: VaultDoc, dek: string, newPassphrase: string): Promise<VaultDoc> => {
  const salt = randomBytesHex(SALT_BYTES);
  const kekHex = await deriveKEKHex(newPassphrase, salt, vault.kdf.iterations);
  return { ...vault, salt, wrappedDEK: aesEncrypt(dek, kekHex), updatedAt: Date.now() };
};

export interface RewrappedRecovery {
  vault: VaultDoc;
  recoveryKey: string;
}

/** Generate a fresh recovery key wrapping the existing DEK (e.g. right after a recovery, or on demand). */
export const rewrapRecovery = async (vault: VaultDoc, dek: string): Promise<RewrappedRecovery> => {
  const recoverySalt = randomBytesHex(SALT_BYTES);
  const recoveryKey = generateRecoveryKey();
  const recoveryKekHex = await deriveKEKHex(normalizeRecoveryKey(recoveryKey), recoverySalt, vault.kdf.iterations);
  return {
    vault: { ...vault, recoverySalt, wrappedDEKRecovery: aesEncrypt(dek, recoveryKekHex), updatedAt: Date.now() },
    recoveryKey,
  };
};

/** Whether a fetched object looks like a usable v2 vault document. */
export const isVaultDoc = (value: unknown): value is VaultDoc => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.salt === "string" &&
    typeof v.wrappedDEK === "string" &&
    typeof v.canary === "string" &&
    typeof v.wrappedDEKRecovery === "string" &&
    typeof v.recoverySalt === "string"
  );
};
