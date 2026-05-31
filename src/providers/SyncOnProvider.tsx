import useNetInfo from "@/hooks/useNetInfo";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { isEmpty, isObjectEmpty } from "@/utils/string";
import { deleteField, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Platform } from "react-native";
import { useSelector } from "react-redux";

import { useAppDispatch } from "@/slicers/store";
import {
  COLLECTIONS,
  getAllDeviceUuids,
  getAllElementsInCloud,
  getDeviceUuid,
  readVault,
  setElementInCloud,
} from "@/libs/firebase";
import { getDEK, isVaultUnlocked, lockVault, wipePersistedDEK } from "@/libs/vaultSession";
import { setVaultPromptNeeded } from "@/libs/vaultPrompt";
import { registerSyncNow } from "@/libs/registry";
import { restoreVaultSession } from "@/libs/vaultManager";
import { dekMatchesVault } from "@/utils/vault";
import { addLocalCategories, deleteLocalCategories, getCloudCategories } from "@/slicers/categoriesSlice";
import { addLocalNotes, deleteLocalNotes, detachLocalNotes, getCloudNotes } from "@/slicers/notesSlice";
import { getCloudConnected, getCloudSettings, setCloudConnected, setIsCloudSyncEnabled } from "@/slicers/settingsSlice";
import { addCloudCategoriesAsync, deleteCloudCategoriesAsync } from "@/slicers/thunks/categories";
import { addCloudNotesAsync, deleteCloudNotesAsync, detachCloudNotesAsync } from "@/slicers/thunks/notes";
import { toast } from "@/utils/toast";

const PENDING_CHANGES_DELAY = 10000;
const DEBOUNCE_NOTES_DELAY = 200;

export default function SyncOnProvider(): null {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const tPendingChanges = useRef<ReturnType<typeof setInterval> | null>(null);
  const tDebounceNotes = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToLocalRef = useRef<(() => Promise<void>) | null>(null);
  const syncToCloudRef = useRef<(() => Promise<void>) | null>(null);
  const isSyncingRef = useRef(false);
  const isSyncingCloudRef = useRef(false);

  const isCloudConnected = useSelector(getCloudConnected);
  const cloudSettings = useSelector(getCloudSettings);
  const netInfo = useNetInfo();

  // Sync is gated on an unlocked vault: without the DEK we cannot decrypt
  // incoming notes nor encrypt outgoing ones.
  const vaultUnlocked = useVaultUnlocked();
  const restoredRef = useRef(false);

  // On (re)connect, restore this device's cached DEK before any sync runs. If
  // none is cached (secure storage cleared, app updated while connected, etc.),
  // raise the "needs attention" signal so home can prompt the user — sync stays
  // paused until they unlock/set up encryption from Cloud settings.
  useEffect(() => {
    if (!isCloudConnected) {
      restoredRef.current = false;
      setVaultPromptNeeded(false);
      return;
    }
    if (restoredRef.current || isVaultUnlocked()) return;
    if (!cloudSettings?.projectId) return;

    restoredRef.current = true;
    restoreVaultSession(cloudSettings.projectId)
      .then(async (restored) => {
        if (!restored) {
          setVaultPromptNeeded(true);
          return;
        }
        // We had a cached DEK — but it may be stale: another device could have
        // reset/replaced the vault while we were off. Verify it against the cloud
        // vault right away (so a restart catches it, not just the 10s sync loop).
        const dek = getDEK();
        const vaultRead = await readVault();
        if (vaultRead.status === "error") return; // offline/transient — trust the cache for now
        const stale = vaultRead.status === "absent" || !dek || !dekMatchesVault(vaultRead.vault!, dek);
        if (stale) {
          lockVault();
          await wipePersistedDEK(cloudSettings.projectId);
          setVaultPromptNeeded(true);
        }
      })
      .catch((e) => {
        // Transient restore/read failure: leave the prompt untouched and let a
        // later reconnect/restart retry. Allow a retry by clearing the guard.
        restoredRef.current = false;
        console.log("restoreVaultSession error:", e);
      });
  }, [isCloudConnected, cloudSettings?.projectId]);

  // Once the vault is unlocked (here or from the Cloud settings flow), the prompt
  // is no longer relevant.
  useEffect(() => {
    if (vaultUnlocked) setVaultPromptNeeded(false);
  }, [vaultUnlocked]);

  const cloudCategories = useSelector(getCloudCategories);
  const cloudCategories_add = useMemo(() => Object.values(cloudCategories.add), [cloudCategories.add]);
  const cloudCategories_delete = useMemo(() => Object.values(cloudCategories.delete), [cloudCategories.delete]);

  const cloudNotes = useSelector(getCloudNotes);
  const cloudNotes_add = useMemo(() => Object.values(cloudNotes.add), [cloudNotes.add]);
  const cloudNotes_delete = useMemo(() => Object.values(cloudNotes.delete), [cloudNotes.delete]);
  const cloudNotes_detach = useMemo(() => Object.values(cloudNotes.detach ?? {}), [cloudNotes.detach]);

  ///////////////////////////////////
  // Pending cloud changes checker
  // syncToLocal - notes & categories
  ///////////////////////////////////

  const syncToLocal = useCallback(async () => {
    // cannot decrypt incoming notes without the DEK
    if (!isVaultUnlocked()) return;

    // prevent concurrent syncs
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // Transient read failure (an offline blip or a stale Firebase channel):
      // skip this tick and let the interval retry on the next one. Do NOT clear
      // the interval here — killing it leaves sync dead until an unrelated dep
      // change or an app restart (the "had to restart to sync" symptom), which
      // is especially bad on desktop where the Firestore channel can die while
      // the OS still reports online, so netInfo never changes to revive it.
      // Genuine offline is already handled by the effect that mounts this
      // interval (it gates on netInfo.isConnected and tears it down).
      if (devices == null) return;

      // device got removed from the cloud, should disconnect
      if (!devices.includes(deviceUuid!)) {
        dispatch(setIsCloudSyncEnabled(false));
        dispatch(setCloudConnected(false));
        if (tPendingChanges.current) clearInterval(tPendingChanges.current);
        toast(t("disconnected"));
        return;
      }

      // only one device connected to the cloud
      if (devices.length == 1 && devices.includes(deviceUuid!)) {
        return;
      }

      // Detect a vault reset/replacement done on another device: if the cloud
      // vault is gone, or no longer matches our cached DEK, our key is stale.
      // Re-lock and prompt instead of syncing (or re-uploading) with a dead key.
      const dek = getDEK();
      const vaultRead = await readVault();
      const vaultChanged =
        vaultRead.status === "absent" ||
        (vaultRead.status === "present" && !!vaultRead.vault && (!dek || !dekMatchesVault(vaultRead.vault, dek)));
      if (vaultChanged) {
        lockVault();
        if (cloudSettings?.projectId) await wipePersistedDEK(cloudSettings.projectId);
        setVaultPromptNeeded(true);
        if (tPendingChanges.current) clearInterval(tPendingChanges.current);
        return;
      }
      // vaultRead.status === "error" -> transient read failure, skip (don't lock)

      const devicesData = await getAllElementsInCloud({
        collection: COLLECTIONS.various.connectedDevices,
        queryConstraints: [where("devicesToSync", "array-contains", deviceUuid)],
      });

      // no pending changes
      if (!devicesData.isPresent) {
        return;
      }

      for (let i = 0; i < devicesData.data.length; i++) {
        const deviceData = devicesData.data[i];

        // Each queue field is guarded against undefined: once cleared via
        // deleteField() the key is absent, and isObjectEmpty() would throw on
        // undefined. This also covers older device docs missing some fields.

        // if there is some "add categories" data, put it in the local "add" object
        if (deviceData.addCategories && !isObjectEmpty(deviceData.addCategories)) {
          dispatch(addLocalCategories(deviceData.addCategories));
        }

        // if there is some "add notes" data, put it in the local "add" object
        if (deviceData.addNotes && !isObjectEmpty(deviceData.addNotes)) {
          dispatch(addLocalNotes(deviceData.addNotes));
        }

        // if there is some "delete notes" data, put it in the local "delete" object
        if (deviceData.deleteNotes && !isObjectEmpty(deviceData.deleteNotes)) {
          dispatch(deleteLocalNotes(deviceData.deleteNotes));
        }

        // if there is some "detach notes" data, mark those notes as offline locally
        if (deviceData.detachNotes && !isObjectEmpty(deviceData.detachNotes)) {
          dispatch(detachLocalNotes(deviceData.detachNotes));
        }

        // if there is some "delete categories" data, put it in the local "delete" object
        if (deviceData.deleteCategories && !isObjectEmpty(deviceData.deleteCategories)) {
          dispatch(deleteLocalCategories(deviceData.deleteCategories));
        }

        const devicesExceptMe = deviceData.devicesToSync.filter((otherDeviceUuid: string) => otherDeviceUuid != deviceUuid);

        await setElementInCloud({
          collection: COLLECTIONS.various.connectedDevices,
          identifier: deviceData.uuid,
          payload: {
            devicesToSync: devicesExceptMe,
            ...(devicesExceptMe.length == 0
              ? {
                  // deleteField() actually removes the queues. Writing `{}` with
                  // merge:true is a no-op on Firestore (nested maps are deep-
                  // merged), so the queues would never clear and a later fan-out
                  // could re-deliver these stale adds/deletes.
                  addCategories: deleteField(),
                  deleteCategories: deleteField(),
                  addNotes: deleteField(),
                  deleteNotes: deleteField(),
                  detachNotes: deleteField(),
                }
              : {}),
          },
          merge: true,
        });
      }

      toast(t("dataSynced"));
    } finally {
      isSyncingRef.current = false;
    }
  }, [dispatch, t, cloudSettings?.projectId]);

  // keep ref in sync for AppState listener
  useEffect(() => {
    syncToLocalRef.current = syncToLocal;
  }, [syncToLocal]);

  ///////////////////////////////////
  // Pending local changes pusher
  // syncToCloud - notes & categories (retriable)
  //
  // Extracted so the periodic interval and the foreground trigger can re-attempt
  // pending uploads, not just the change-driven effects below. Without this, a
  // change made while the Firebase channel was down stays queued until the next
  // local edit or an app restart (the "didn't sync until I restarted" symptom).
  ///////////////////////////////////

  const syncToCloud = useCallback(async () => {
    // notes are encrypted before upload -> needs the DEK
    if (!isVaultUnlocked()) return;

    const hasCategories = !isEmpty(cloudCategories_add) || !isEmpty(cloudCategories_delete);
    const hasNotes = !isEmpty(cloudNotes_add) || !isEmpty(cloudNotes_delete) || !isEmpty(cloudNotes_detach);
    if (!hasCategories && !hasNotes) return;

    // prevent the change-driven, interval and foreground triggers from overlapping
    if (isSyncingCloudRef.current) return;
    isSyncingCloudRef.current = true;

    try {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // transient read failure: keep the queues and retry on the next trigger
      if (devices == null) return;

      const devicesExceptMe = devices.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);
      const areMoreThanOneDevice = devicesExceptMe.length > 0;

      if (!isEmpty(cloudCategories_add)) {
        await dispatch(
          addCloudCategoriesAsync({ deviceUuid: deviceUuid!, devicesToSync: devicesExceptMe, areMoreThanOneDevice })
        ).unwrap();
      }
      if (!isEmpty(cloudCategories_delete)) {
        await dispatch(
          deleteCloudCategoriesAsync({ deviceUuid: deviceUuid!, devicesToSync: devicesExceptMe, areMoreThanOneDevice })
        ).unwrap();
      }
      if (!isEmpty(cloudNotes_add)) {
        await dispatch(
          addCloudNotesAsync({ deviceUuid: deviceUuid!, devicesToSync: devicesExceptMe, areMoreThanOneDevice })
        ).unwrap();
      }
      if (!isEmpty(cloudNotes_delete)) {
        await dispatch(
          deleteCloudNotesAsync({ deviceUuid: deviceUuid!, devicesToSync: devicesExceptMe, areMoreThanOneDevice })
        ).unwrap();
      }
      if (!isEmpty(cloudNotes_detach)) {
        await dispatch(
          detachCloudNotesAsync({ deviceUuid: deviceUuid!, devicesToSync: devicesExceptMe, areMoreThanOneDevice })
        ).unwrap();
      }
    } catch (e) {
      console.log("syncToCloud error:", e);
    } finally {
      isSyncingCloudRef.current = false;
    }
  }, [dispatch, cloudCategories_add, cloudCategories_delete, cloudNotes_add, cloudNotes_delete, cloudNotes_detach]);

  useEffect(() => {
    syncToCloudRef.current = syncToCloud;
  }, [syncToCloud]);

  // Expose a manual "sync now" trigger for the Devices screen: a full pull +
  // push for this device, for the rare case automatic sync didn't fire. Uses
  // the refs so it always runs the latest implementations; registered once.
  useEffect(() => {
    registerSyncNow(async () => {
      await syncToLocalRef.current?.();
      await syncToCloudRef.current?.();
    });
  }, []);

  ///////////////////////////////////
  // Pending cloud changes checker
  // syncToLocal - notes & categories
  ///////////////////////////////////

  useEffect(() => {
    if (tPendingChanges.current) clearInterval(tPendingChanges.current);

    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected || !vaultUnlocked) {
      return;
    }

    // each tick: pull incoming, then re-attempt any pending outgoing uploads
    const tick = () => {
      syncToLocal();
      syncToCloudRef.current?.();
    };

    tick();
    tPendingChanges.current = setInterval(tick, PENDING_CHANGES_DELAY);

    return () => {
      if (tPendingChanges.current) clearInterval(tPendingChanges.current);
    };
  }, [isCloudConnected, netInfo, vaultUnlocked, syncToLocal]);

  ///////////////////////////////////
  // AppState listener - sync immediately on foreground resume
  ///////////////////////////////////

  useEffect(() => {
    // on web/tauri, use visibilitychange instead
    if (Platform.OS === "web") {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          syncToLocalRef.current?.();
          syncToCloudRef.current?.();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // app came back to foreground, sync immediately (in + out)
        syncToLocalRef.current?.();
        syncToCloudRef.current?.();
      }
    });

    return () => {
      appStateSubscription?.remove();
    };
  }, []);

  ///////////////////////////////////
  // Pending local changes checker
  // syncToCloud - categories
  ///////////////////////////////////

  useEffect(() => {
    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected || !vaultUnlocked) {
      return;
    }

    // if both groups are empty, nothing to push
    if (isEmpty(cloudCategories_add) && isEmpty(cloudCategories_delete)) {
      return;
    }

    syncToCloudRef.current?.();
  }, [isCloudConnected, netInfo, vaultUnlocked, cloudCategories_add, cloudCategories_delete]);

  ///////////////////////////////////
  // Pending local changes checker
  // syncToCloud - notes
  ///////////////////////////////////

  useEffect(() => {
    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected || !vaultUnlocked) {
      return;
    }

    // if all groups are empty, nothing to push
    if (isEmpty(cloudNotes_add) && isEmpty(cloudNotes_delete) && isEmpty(cloudNotes_detach)) {
      return;
    }

    // debounced so rapid edits batch into a single upload
    if (tDebounceNotes.current) clearTimeout(tDebounceNotes.current);
    tDebounceNotes.current = setTimeout(() => syncToCloudRef.current?.(), DEBOUNCE_NOTES_DELAY);

    return () => {
      if (tDebounceNotes.current) clearTimeout(tDebounceNotes.current);
    };
  }, [isCloudConnected, netInfo, vaultUnlocked, cloudNotes_add, cloudNotes_delete, cloudNotes_detach]);

  return null;
}
