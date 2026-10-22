import { useSyncExternalStore } from "react";

import useNetInfo from "@/hooks/useNetInfo";
import { getCloudStatus, onSyncEvent } from "@/libs/cloud/sync";

const subscribe = (onChange: () => void) =>
  onSyncEvent((event) => {
    if (event.type === "reachability") onChange();
  });

/**
 * Whether the cloud can't be reached while this device is online (ADR-029): a server behind a VPN left off, say. Offline,
 * nothing to tell: the user knows.
 */
export function useCloudStatus(): { unreachable: boolean; lastContact: number | null } {
  const { unreachable, lastContact } = useSyncExternalStore(subscribe, getCloudStatus);
  const { isConnected } = useNetInfo();
  return { unreachable: unreachable && isConnected, lastContact };
}
