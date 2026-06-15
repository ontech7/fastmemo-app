// Test-only stub for expo-crypto (native module) so the bundle loads under node.
// Never actually called in tests (secureRandom prefers globalThis.crypto), but
// must be importable without pulling in react-native.
export const getRandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
