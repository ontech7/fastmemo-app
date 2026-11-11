import AsyncStorage from "@react-native-async-storage/async-storage";

import { randomBytes } from "@/utils/secureRandom";

/**
 * The installation code: a random `FM-XXXX-XXXX` made once per installation (ADR-035). It is derived from nothing on
 * the device, so it says nothing about the person; it only lets a report be matched with the errors of the same
 * installation (it is Sentry's user id). "Wipe data" keeps it.
 */
export const INSTALL_ID_KEY = "@installId";

/** 32 symbols, without the look-alikes 0 O 1 I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INSTALL_ID_RE = /^FM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** A code from 8 random bytes: one symbol per byte (its low 5 bits). */
export function makeInstallId(bytes: Uint8Array): string {
  let symbols = "";
  for (let i = 0; i < 8; i++) {
    symbols += ALPHABET[(bytes[i] ?? 0) & 31];
  }
  return `FM-${symbols.slice(0, 4)}-${symbols.slice(4, 8)}`;
}

export function isInstallId(value: unknown): value is string {
  return typeof value === "string" && INSTALL_ID_RE.test(value);
}

let current: string | null = null;
let loading: Promise<string> | null = null;

async function load(): Promise<string> {
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(INSTALL_ID_KEY);
  } catch {
    // A read that failed says nothing about what is stored: never write over it (LL-039). A code for this session only.
    current = makeInstallId(randomBytes(8));
    return current;
  }

  if (isInstallId(stored)) {
    current = stored;
    return current;
  }

  current = makeInstallId(randomBytes(8));
  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, current);
  } catch {
    // Not kept: the next start makes another. Nothing else depends on it.
  }
  return current;
}

/** The installation code, made and stored at the first call. Never rejects; concurrent first calls share one read. */
export function getInstallId(): Promise<string> {
  if (current) return Promise.resolve(current);
  loading ??= load();
  return loading;
}

/** The code once `getInstallId` has resolved, otherwise null (for a screen that must show it at once). */
export function peekInstallId(): string | null {
  return current;
}
