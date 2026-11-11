// Test-only stand-in for @react-native-async-storage/async-storage: an in-memory map. Its state lives on globalThis, so
// a test that imports a fresh copy of a bundle (to start a module from zero) still sees the same storage.
// Test switches: __reset() empties it and zeroes the write count; __failReads(true) makes every read reject.

const state = (globalThis.__asyncStorageStub ??= { map: new Map(), writes: 0, failReads: false });

const storage = {
  async getItem(key) {
    if (state.failReads) throw new Error("stub: read failed");
    return state.map.has(key) ? state.map.get(key) : null;
  },
  async setItem(key, value) {
    state.writes++;
    state.map.set(key, String(value));
  },
  async removeItem(key) {
    state.writes++;
    state.map.delete(key);
  },
  /** The stored value, or undefined (not part of AsyncStorage). */
  get(key) {
    return state.map.get(key);
  },
  /** How many writes (set or remove) since the last reset (not part of AsyncStorage). */
  get writes() {
    return state.writes;
  },
  __reset() {
    state.map.clear();
    state.writes = 0;
    state.failReads = false;
  },
  __failReads(fail) {
    state.failReads = Boolean(fail);
  },
};

export default storage;
