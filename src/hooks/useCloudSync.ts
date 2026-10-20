import type { CloudProvider, CloudSettings } from "@/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { cloud, cloudScope, getDeviceUuid, getThisDevice, normalizeServerUrl, providerOf } from "@/libs/cloud";
import { getSyncEngine, syncNow } from "@/libs/cloud/sync";
import type { SyncEngine } from "@/libs/cloud/syncEngine";
import { useRouter } from "@/hooks/useRouter";
import { storeVaultContinuation } from "@/libs/registry";
import { isVaultUnlocked } from "@/libs/vaultSession";
import { beginVaultProgress, clearVaultProgress, setVaultProgress } from "@/libs/vaultProgress";
import { forgetDeviceVault, probeVault } from "@/libs/vaultManager";
import { toast } from "@/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { store } from "@/slicers/store";
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

/** Leaving a cloud is best effort: a step that doesn't answer in time (offline, a captive portal) is given up on. */
const CLEANUP_TIMEOUT_MS = 8000;

const bounded = async (step: Promise<unknown>): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    step.catch((e) => console.log("cloud cleanup:", e)),
    new Promise((resolve) => (timer = setTimeout(resolve, CLEANUP_TIMEOUT_MS))),
  ]);
  clearTimeout(timer);
};

/** Stops the engine and waits (bounded) for the task it was running: nothing it does then lands on another connection. */
const stopEngine = async (): Promise<{ engine: SyncEngine; wasRunning: boolean } | null> => {
  const engine = await getSyncEngine();
  if (!engine) return null;
  const wasRunning = engine.isRunning;
  engine.stop();
  await bounded(engine.idle());
  return { engine, wasRunning };
};

export const useCloudSync = () => {
  const { t } = useTranslation();

  const router = useRouter();

  const selectorCloudSyncEnabled = useSelector(selectorIsCloudSyncEnabled);
  const selectorCloudSettings = useSelector(getCloudSettings);
  const selectorCloudConnected = useSelector(getCloudConnected);

  const [cloudSettings, setLocalCloudSettings] = useState<CloudSettings>(selectorCloudSettings);
  const provider = providerOf(cloudSettings);
  /** The settings as the connection uses them (and as they're saved). */
  const connectionSettings: CloudSettings =
    provider === "server"
      ? {
          ...cloudSettings,
          provider,
          serverUrl: normalizeServerUrl(cloudSettings.serverUrl ?? ""),
          serverKey: (cloudSettings.serverKey ?? "").trim(),
        }
      : {
          ...cloudSettings,
          provider,
          authDomain: (cloudSettings.projectId ?? "") + ".firebaseapp.com",
          storageBucket: (cloudSettings.projectId ?? "") + ".appspot.com",
          messagingSenderId: cloudSettings.appId.split(":")?.[1] ?? "",
        };
  /** What this device's vault key is cached under (the vault screens get it as `projectId`). */
  const scope = cloudScope(connectionSettings);

  const [isCloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(selectorCloudSyncEnabled);
  const [isConnected, setIsConnected] = useState<boolean>(selectorCloudConnected);
  const [isConnecting, setIsConnecting] = useState<ConnectingState>({ loading: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [handshakeFailed, setHandshakeFailed] = useState<boolean>(false);

  const dispatch = useDispatch();

  /**
   * Leaves the connected cloud: this device is removed from it and forgets its vault key there (`scopes`: the saved
   * connection's, and the form's when it differs). The cloud vault stays, so reconnecting (or another device) can still
   * unlock it with the passphrase. Best effort: a call that fails (offline) still disconnects here, so the user never gets
   * stuck half on.
   */
  const leaveCloud = async (scopes: string[]): Promise<void> => {
    try {
      // Stopped first, its task over: removing this device would otherwise read as "removed by another device".
      await stopEngine();

      const me = await getDeviceUuid();
      if (me) {
        // Removed first, so the others stop making it a recipient; then nobody waits for its acks anymore.
        await bounded(
          (async () => {
            await cloud.unregisterDevice(me);
            await cloud.dropRecipient(me);
          })()
        );
      }

      for (const forgotten of new Set(scopes)) if (forgotten) await forgetDeviceVault(forgotten);

      await bounded(cloud.dispose());
    } catch (e) {
      console.log("cloud cleanup error:", e);
    }

    setIsConnected(false);
    dispatch(setCloudConnected(false));

    await AsyncStorage.setItem("@cloudSync", JSON.stringify({})).catch(() => {});
  };

  const toggleCloudSync = async (): Promise<void> => {
    if (isCloudSyncEnabled) await leaveCloud([cloudScope(selectorCloudSettings), scope]);

    setCloudSyncEnabled(!isCloudSyncEnabled);
    dispatch(setIsCloudSyncEnabled(!isCloudSyncEnabled));
  };

  const setCloudSetting = (name: Exclude<keyof CloudSettings, "provider">, value: string): void => {
    setLocalCloudSettings({
      ...cloudSettings,
      // Identifiers, addresses and keys never contain whitespace, but a paste can carry some along.
      [name]: value.trim(),
    });
  };

  const setCloudProvider = (next: CloudProvider): void => {
    setLocalCloudSettings({ ...cloudSettings, provider: next });
  };

  const saveCloudSettings = async (): Promise<void> => {
    setIsConnecting({ loading: true });
    setIsLoading(true);

    if (selectorCloudConnected) {
      await changeCloudSettings(selectorCloudSettings);
      return;
    }

    cloud.init(connectionSettings);

    const ok = await cloud.verify();
    setIsConnecting({ loading: false, code: ok ? Handshake.Success : Handshake.Fail });
  };

  /**
   * New settings on a connected device, checked first on a connection of their own: if they don't work, the device stays
   * connected as it was (the dialog explains, the form keeps them to correct). Another cloud is then left, as turning sync
   * off does, and connected as usual. The same cloud with new credentials (a rotated access key, a new API key) only takes
   * them: no re-registration, no vault flow.
   */
  const changeCloudSettings = async (saved: CloudSettings): Promise<void> => {
    if (!(await cloud.check(connectionSettings))) {
      setIsConnecting({ loading: false });
      setIsLoading(false);
      setHandshakeFailed(true);
      return;
    }

    if (cloudScope(saved) !== scope || providerOf(saved) !== provider) {
      await leaveCloud([cloudScope(saved)]);
      cloud.init(connectionSettings);
      // Checked above: on to the device limit and the vault.
      setIsConnecting({ loading: false, code: Handshake.Success });
      return;
    }

    const stopped = await stopEngine();
    cloud.init(connectionSettings);
    await AsyncStorage.setItem("@cloudSync", JSON.stringify(connectionSettings));
    dispatch(setCloudSettings(connectionSettings));
    // Again if it ran, unless the device was disconnected or locked meanwhile (the provider starts it when that changes).
    if (stopped?.wasRunning && store.getState().settings?.cloudConnected && isVaultUnlocked()) stopped.engine.start();
    setIsConnected(true);
    setIsConnecting({ loading: false });
    setIsLoading(false);
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
    const projectId = scope;

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
    const target = { pathname: "/settings/cloud-sync/vault-reset", params: { projectId: scope } } as const;
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
          if (others.length >= cloud.deviceLimit) {
            setIsLoading(false);
            toast(t("devicesLimitReached"));
            return;
          }

          const projectId = scope;

          // Finalize the connection once the vault has been unlocked/created and
          // the DEK is in the session (the vault screen runs this continuation).
          const finalizeConnection = async () => {
            const device = await getThisDevice();
            if (!device || !(await cloud.registerDevice(device))) throw new Error("device registration failed");
            await syncCloudData(true);
            await AsyncStorage.setItem("@cloudSync", JSON.stringify(connectionSettings));
            setIsConnected(true);
            dispatch(setCloudConnected(true));
            dispatch(setCloudSettings(connectionSettings));
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
      setCloudProvider,
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
    provider,
  };
};
