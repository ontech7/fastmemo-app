import type { FastmemoCryptoApi } from "./FastmemoCrypto.types";

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("invalid hex");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// WebCrypto only exists in a secure context; elsewhere callers fall back to the JS implementation.
const subtle = globalThis.crypto?.subtle;

const FastmemoCryptoWeb: FastmemoCryptoApi | null = subtle
  ? {
      async pbkdf2Sha256Async(password, saltHex, iterations, keyLength) {
        const passwordBytes = new TextEncoder().encode(password);
        // HMAC zero-pads its key to the block size, so an empty password is the same key as a single
        // zero byte (not every engine accepts an empty raw key).
        const key = await subtle.importKey(
          "raw",
          passwordBytes.length > 0 ? passwordBytes : new Uint8Array(1),
          "PBKDF2",
          false,
          ["deriveBits"]
        );
        const bits = await subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
          key,
          keyLength * 8
        );
        return bytesToHex(new Uint8Array(bits));
      },
    }
  : null;

export default FastmemoCryptoWeb;
