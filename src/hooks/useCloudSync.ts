import { configs } from "@/configs";
import type { CloudSettings } from "@/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { cloud, getDeviceUuid, getThisDevice } from "@/libs/cloud";
import { getSyncEngine, syncNow } from "@/libs/cloud/sync";
import { useRouter } from "@/hooks/useRouter";
import { storeVaultContinuation } from "@/libs/registry";
import { isVaultUnlocked } from "@/libs/vaultSession";
import { beginVaultProgress, clearVaultProgress, setVaultProgress } from "@/libs/vaultProgress";
import { forgetDeviceVault, probeVault } from "@/libs/vaultManager";
import { toast } from "@/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getCloudConnected,
  getCloudSettings,
  selectorIsCloudSyncEnabled,
  setCloudConnected,
  setCloudSettings,
  setIsCloudSyncEnabled,
} from "@/slicers/settingsSlice";

/** Outcome of the connection check (a write + delete round trip). */
const Handshake = {
  Fail: 0,
  Success: 1,
} as const;

interface ConnectingState {
  loading: boolean;
  code?: number;
}

export const useCloudSync = () => {
  const { t } = useTranslation();

  const router = useRouter();

  const selectorCloudSyncEnabled = useSelector(selectorIsCloudSyncEnabled);
  const selectorCloudSettings = useSelector(getCloudSettings);
  const selectorCloudConnected = useSelector(getCloudConnected);

  const [cloudSettings, setLocalCloudSettings] = useState<CloudSettings>(selectorCloudSettings);
  const firestoreSettings: CloudSettings = {
    ...cloudSettings,
    authDomain: (cloudSettings.projectId ?? "") + ".firebaseapp.com",
    storageBucket: (cloudSettings.projectId ?? "") + ".appspot.com",
    messagingSenderId: cloudSettings.appId.split(":")?.[1] ?? "",
  };

  const [isCloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(selectorCloudSyncEnabled);
  const [isConnected, setIsConnected] = useState<boolean>(selectorCloudConnected);
  const [isConnecting, setIsConnecting] = useState<ConnectingState>({ loading: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [handshakeFailed, setHandshakeFailed] = useState<boolean>(false);

  const dispatch = useDispatch();

  const toggleCloudSync = async (): Promise<void> => {
    if (isCloudSyncEnabled) {
      // Best-effort cloud cleanup. If a call rejects (transient/offline) we still
      // disconnect locally below, so the user never gets stuck in a half-on state
      // with no way to toggle off.
      try {
        // Stopped first: removing this device would otherwise read as "removed by another device".
        (await getSyncEngine())?.stop();

        const me = await getDeviceUuid();
        if (me) {
          // Removed first, so the others stop making it a recipient; then nobody waits for its acks anymore.
          await cloud.unregisterDevice(me);
          await cloud.dropRecipient(me);
        }

        // forget the cached DEK for this device, but leave the cloud vault intact
        // so reconnecting (or another device) can still unlock with the passphrase
        if (cloudSettings.projectId) await forgetDeviceVault(cloudSettings.projectId);

        await cloud.dispose();
      } catch (e) {
        console.log("toggleCloudSync cleanup error:", e);
      }

      setIsConnected(false);
      dispatch(setCloudConnected(false));

      AsyncStorage.setItem("@cloudSync", JSON.stringify({}));
    }

    setCloudSyncEnabled(!isCloudSyncEnabled);
    dispatch(setIsCloudSyncEnabled(!isCloudSyncEnabled));
  };

  const setCloudSetting = (name: keyof CloudSettings, value: string): void => {
    setLocalCloudSettings({
      ...cloudSettings,
      // Firebase identifiers never contain whitespace, but a paste can carry some along.
      [name]: value.trim(),
    });
  };

  const saveCloudSettings = async (): Promise<void> => {
    setIsConnecting({ loading: true });
    setIsLoading(true);

    cloud.init(firestoreSettings);

    const ok = await cloud.verify();
    setIsConnecting({ loading: false, code: ok ? Handshake.Success : Handshake.Fail });
  };

  const editCloudSettings = (): void => {
    setIsConnected(false);
  };

  /**
   * Route an already-connected device that has no usable key yet to the right
   * encryption screen: unlock if a vault exists, otherwise set it up / migrate
   * legacy data. Covers the "updated the app while already connected" case where
   * no vault has ever been created. On success it just resyncs.
   */
  const requestVaultAccess = async (): Promise<void> => {
    const projectId = cloudSettings.projectId;

    // Probe first: on an unverifiable read, do NOT route to create (it could
    // overwrite an existing vault). Ask the user to retry instead.
    const probe = await probeVault();
    if (probe.presence === "error") {
      toast(t("cloudsync.vault.verify_failed"));
      return;
    }

    storeVaultContinuation(async () => {
      await syncCloudData(false);
    });

    if (probe.presence === "present") {
      router.push({ pathname: "/settings/cloud-sync/vault-unlock", params: { projectId } });
    } else if (probe.needsMigration) {
      router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "migrate" } });
    } else {
      router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "create" } });
    }
  };

  /**
   * Open the last-resort reset flow. It wipes the cloud vault + notes and then
   * recreates a vault, re-uploading local notes via this resync continuation.
   * `useReplace` swaps the secret-code screen when unlock wasn't via fingerprint
   * (mirrors the "manage devices" gating), so the back stack stays clean.
   */
  const requestReset = (useReplace: boolean): void => {
    storeVaultContinuation(async () => {
      await syncCloudData(false);
    });
    const target = { pathname: "/settings/cloud-sync/vault-reset", params: { projectId: cloudSettings.projectId } } as const;
    if (useReplace) {
      router.replace(target);
    } else {
      router.push(target);
    }
  };

  /**
   * Full sync (ADR-016): merges the cloud with this device's notes, never replacing them, and uploads only what this
   * device has newer. The upload drives the vault screens' progress bar (it's what takes time on setup, migration and
   * reset). False if it couldn't complete; it then runs again when the engine next starts.
   */
  const syncCloudData = async (loadingMethodDisabled?: boolean): Promise<boolean> => {
    // Notes are encrypted and decrypted with the DEK: nothing to do while the vault is locked (the UI asks to unlock).
    if (!isVaultUnlocked()) return false;

    if (!loadingMethodDisabled) setIsLoading(true);

    try {
      return await syncNow((done, total) => {
        if (done === 0 || !total) beginVaultProgress(total);
        else setVaultProgress(done, total);
      });
    } finally {
      clearVaultProgress();
      if (!loadingMethodDisabled) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnecting?.loading) return;

    const asyncHandshake = async () => {
      switch (isConnecting?.code) {
        case Handshake.Success: {
          const cloudDevices = await cloud.listDevices();

          if (!cloudDevices) {
            setIsLoading(false);
            toast(t("cloudsync.vault.verify_failed"));
            return;
          }

          const me = await getDeviceUuid();
          const others = cloudDevices.filter((device) => device.uuid !== me);
          if (others.length >= configs.cloud.deviceLimit) {
            setIsLoading(false);
            toast(t("devicesLimitReached"));
            return;
          }

          const projectId = firestoreSettings.projectId;

          // Finalize the connection once the vault has been unlocked/created and
          // the DEK is in the session (the vault screen runs this continuation).
          const finalizeConnection = async () => {
            const device = await getThisDevice();
            if (!device || !(await cloud.registerDevice(device))) throw new Error("device registration failed");
            await syncCloudData(true);
            await AsyncStorage.setItem("@cloudSync", JSON.stringify(firestoreSettings));
            setIsConnected(true);
            dispatch(setCloudConnected(true));
            dispatch(setCloudSettings(firestoreSettings));
            setIsLoading(false);
          };

          // Decide which vault path to take, then hand off to its screen. The DEK
          // must exist before any sync, so we never finalize here directly.
          const probe = await probeVault();

          // Unverifiable read: abort the connect rather than risk creating a
          // vault over an existing one. Nothing has been finalized yet.
          if (probe.presence === "error") {
            setIsLoading(false);
            toast(t("cloudsync.vault.verify_failed"));
            return;
          }

          storeVaultContinuation(finalizeConnection);
          setIsLoading(false);

          if (probe.presence === "present") {
            router.push({ pathname: "/settings/cloud-sync/vault-unlock", params: { projectId } });
          } else if (probe.needsMigration) {
            router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "migrate" } });
          } else {
            router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "create" } });
          }
          break;
        }
        case Handshake.Fail:
          setIsConnected(false);
          dispatch(setCloudConnected(false));

          await AsyncStorage.setItem("@cloudSync", JSON.stringify({}));

          setIsLoading(false);

          setHandshakeFailed(true);

          break;
        default:
          break;
      }
    };

    asyncHandshake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnecting]);

  return {
    methods: {
      toggleCloudSync,
      setCloudSetting,
      saveCloudSettings,
      editCloudSettings,
      requestVaultAccess,
      requestReset,
      syncCloudData,
      dismissHandshakeFailed: () => setHandshakeFailed(false),
    },
    state: {
      isLoading,
      isCloudSyncEnabled: selectorCloudSyncEnabled,
      isConnecting: isConnecting?.loading ?? false,
      isConnected,
      isEditable: !isConnecting?.loading && !isConnected,
      handshakeFailed,
    },
    cloudSettings,
  };
};
