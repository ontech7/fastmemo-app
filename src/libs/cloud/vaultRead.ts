import { isVaultDoc, VAULT_VERSION } from "@/utils/vault";

import type { VaultRead } from "./types";

/**
 * A stored vault doc as a read. A malformed doc, or one written by a newer app version (a KDF/format this build can't
 * handle), is an error: never unlock against it nor overwrite it. Shared by the backends.
 */
export const toVaultRead = (data: unknown): VaultRead => {
  if (data === undefined || data === null) return { status: "absent", vault: null };
  if (!isVaultDoc(data)) return { status: "error", vault: null };
  if (typeof data.version === "number" && data.version > VAULT_VERSION) return { status: "error", vault: null };
  return { status: "present", vault: data };
};
