import { useSyncExternalStore } from "react";

import { getVaultPromptNeeded, subscribeVaultPrompt } from "@/libs/vaultPrompt";

/** Reactive view of whether the "encryption needs attention" prompt should show. */
export const useVaultPrompt = (): boolean =>
  useSyncExternalStore(subscribeVaultPrompt, getVaultPromptNeeded, getVaultPromptNeeded);
