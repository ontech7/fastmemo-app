import useNetInfo from "@/hooks/useNetInfo";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Platform } from "react-native";
import { useSelector } from "react-redux";

import { notesLoaded, useAppDispatch } from "@/slicers/store";
import { cloud, cloudScope, getDeviceUuid } from "@/libs/cloud";
import { clearPresenceDevices, setPresenceDevices } from "@/libs/cloud/presence";
import { getSyncEngine, onSyncEvent, syncIfDue } from "@/libs/cloud/sync";
import { isVaultUnlocked, lockVault, wipePersistedDEK } from "@/libs/vaultSession";
import { setVaultPromptNeeded } from "@/libs/vaultPrompt";
import { forgetDeviceVault, restoreVaultSession } from "@/libs/vaultManager";
import { getCloudConnected, getCloudSettings, setCloudConnected, setIsCloudSyncEnabled } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Runs the sync engine (`libs/cloud/syncEngine`, ADR-016) while the cloud is connected and the vault unlocked, and turns
 * its events into app state: toasts, disconnect, vault prompt.
 */
export default function SyncOnProvider(): null {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const isCloudConnected = useSelector(getCloudConnected);
  const cloudSettings = useSelector(getCloudSettings);
  // What this device's vault key is cached under: the Firebase project, or the server's address.
  const projectId = cloudScope(cloudSettings);
  const netInfo = useNetInfo();
  const isOnline = !!netInfo?.isConnected;

  // Sync is gated on an unlocked vault: without the DEK we cannot decrypt
  // incoming notes nor encrypt outgoing ones.
  const vaultUnlocked = useVaultUnlocked();
  const restoredRef = useRef(false);

  // On (re)connect, restore this device's cached DEK before any sync runs. If
  // none is cached (secure storage cleared, app updated while connected, etc.),
  // raise the "needs attention" signal so home can prompt the user — sync stays
  // paused until they unlock/set up encryption from Cloud settings. A cached DEK
  // that went stale (vault reset elsewhere) is caught by the engine's vault check.
  useEffect(() => {
    if (!isCloudConnected) {
      restoredRef.current = false;
      setVaultPromptNeeded(false);
      return;
    }
    if (restoredRef.current || isVaultUnlocked()) return;
    if (!projectId) return;

    restoredRef.current = true;
    restoreVaultSession(projectId)
      .then((restored) => {
        if (!restored) setVaultPromptNeeded(true);
      })
      .catch((e) => {
        // Transient restore failure: let a later reconnect/restart retry.
        restoredRef.current = false;
        console.log("restoreVaultSession error:", e);
      });
  }, [isCloudConnected, projectId]);

  // Once the vault is unlocked (here or from the Cloud settings flow), the prompt
  // is no longer relevant.
  useEffect(() => {
    if (vaultUnlocked) setVaultPromptNeeded(false);
  }, [vaultUnlocked]);

  // The engine runs while connected and unlocked. Offline it keeps running: the listeners resume by themselves and the
  // outbox waits.
  useEffect(() => {
    // Notes that couldn't be read at launch aren't written this session either (LL-039): nothing would stay merged.
    if (!isCloudConnected || !vaultUnlocked || !notesLoaded()) return;

    let stopped = false;
    let stop = () => {};
    getSyncEngine().then((engine) => {
      if (stopped || !engine) return;
      engine.start();
      stop = () => engine.stop();
      syncIfDue();
    });

    return () => {
      stopped = true;
      stop();
      clearPresenceDevices();
    };
  }, [isCloudConnected, vaultUnlocked]);

  const projectIdRef = useRef(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(
    () =>
      onSyncEvent((event) => {
        switch (event.type) {
          case "applied":
            if (event.conflicts.length > 0) {
              toast(t("cloudsync.conflict_copies"));
            } else if (!event.full && (event.changed.some((id) => id !== event.openNote) || event.categories)) {
              // The open note's editor shows its changes as they come: they need no toast (it'd repeat while another
              // device types).
              toast(t("dataSynced"));
            }
            break;
          case "devices":
            getDeviceUuid().then((me) => me && setPresenceDevices(event.devices, me));
            break;
          case "removed":
            // Removed from another device's device list: disconnect here as well.
            dispatch(setIsCloudSyncEnabled(false));
            dispatch(setCloudConnected(false));
            AsyncStorage.setItem("@cloudSync", JSON.stringify({}));
            if (projectIdRef.current) forgetDeviceVault(projectIdRef.current);
            cloud.dispose();
            toast(t("disconnected"));
            break;
          case "vaultStale":
            // The vault was reset or replaced elsewhere: this key is dead. Lock and ask for the new passphrase.
            lockVault();
            if (projectIdRef.current) wipePersistedDEK(projectIdRef.current);
            setVaultPromptNeeded(true);
            break;
        }
      }),
    [dispatch, t]
  );

  // Back online: revive the transport and catch up.
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const cameBack = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (cameBack) getSyncEngine().then((engine) => engine?.resume());
  }, [isOnline]);

  // Back in the foreground: a hidden window or a sleeping desktop is exactly when the Firestore channel wedges, so the
  // engine reconnects it before catching up.
  useEffect(() => {
    const resume = () => getSyncEngine().then((engine) => engine?.resume());

    if (Platform.OS === "web") {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") resume();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") resume();
    });
    return () => appStateSubscription.remove();
  }, []);

  return null;
}
