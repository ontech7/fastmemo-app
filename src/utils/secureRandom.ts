import * as ExpoCrypto from "expo-crypto";

/**
 * Cryptographically secure randomness for key material (DEK, salts, recovery key).
 *
 * IMPORTANT: do NOT use CryptoJS's `WordArray.random` for secrets — the
 * react-native-crypto-js fork backs it with `Math.random()`, which is not
 * cryptographically secure and would yield predictable keys. We source entropy
 * from the platform CSPRNG instead:
 *  - web / Tauri WebView: `globalThis.crypto.getRandomValues`
 *  - native (Hermes, no WebCrypto global): `expo-crypto.getRandomBytes` (sync,
 *    backed by the OS secure RNG).
 */

const toHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

/** Secure random bytes. */
export const randomBytes = (byteCount: number): Uint8Array => {
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webcrypto?.getRandomValues) {
    return webcrypto.getRandomValues(new Uint8Array(byteCount));
  }
  // Native fallback — synchronous OS-backed RNG.
  return ExpoCrypto.getRandomBytes(byteCount);
};

/** Secure random bytes as a lowercase hex string. */
export const randomBytesHex = (byteCount: number): string => toHex(randomBytes(byteCount));
