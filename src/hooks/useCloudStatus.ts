import { useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import useNetInfo from "@/hooks/useNetInfo";
import { getCloudStatus, onSyncEvent } from "@/libs/cloud/sync";
import { getCloudConnected } from "@/slicers/settingsSlice";

/** The cloud as the status dot shows it: answering, this device offline, or not answering while online. */
export type CloudState = "ok" | "offline" | "unreachable";

const subscribe = (onChange: () => void) =>
  onSyncEvent((event) => {
    if (event.type === "reachability") onChange();
  });

/**
 * Whether the cloud can't be reached while this device is online (ADR-029): a server behind a VPN left off, say. Offline,
 * nothing to tell: the user knows. `state` is what the status dot shows (null: not connected, or no answer nor failure yet).
 */
export function useCloudStatus(): { unreachable: boolean; lastContact: number | null; state: CloudState | null } {
  const { unreachable, lastContact } = useSyncExternalStore(subscribe, getCloudStatus);
  const { isConnected } = useNetInfo();
  const connected = useSelector(getCloudConnected);
  const state: CloudState | null = !connected
    ? null
    : !isConnected
      ? "offline"
      : unreachable
        ? "unreachable"
        : lastContact !== null
          ? "ok"
          : null;
  return { unreachable: unreachable && isConnected, lastContact, state };
}

/** The words for a state, naming the cloud in use: "Server unreachable" says what to check. */
export const cloudStateKey = (state: CloudState, server: boolean) =>
  state === "offline"
    ? "noInternetConnection"
    : state === "unreachable"
      ? server
        ? "cloudsync.unreachable_server"
        : "cloudsync.unreachable_firebase"
      : server
        ? "cloudsync.reachable_server"
        : "cloudsync.reachable_firebase";
