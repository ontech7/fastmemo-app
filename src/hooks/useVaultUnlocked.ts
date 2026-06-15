import { useSyncExternalStore } from "react";

import { isVaultUnlocked, subscribeVault } from "@/libs/vaultSession";

/** Reactive view of whether the vault is currently unlocked on this device. */
export const useVaultUnlocked = (): boolean => useSyncExternalStore(subscribeVault, isVaultUnlocked, isVaultUnlocked);
