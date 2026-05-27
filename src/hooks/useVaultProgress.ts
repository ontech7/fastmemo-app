import { useSyncExternalStore } from "react";

import { getVaultProgress, subscribeVaultProgress, type VaultProgress } from "@/libs/vaultProgress";

/** Reactive view of the current vault upload progress (null when idle). */
export const useVaultProgress = (): VaultProgress | null =>
  useSyncExternalStore(subscribeVaultProgress, getVaultProgress, getVaultProgress);
