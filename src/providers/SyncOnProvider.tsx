import useNetInfo from "@/hooks/useNetInfo";
import { isEmpty, isObjectEmpty } from "@/utils/string";
import { where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Platform } from "react-native";
import { useSelector } from "react-redux";

import { useAppDispatch } from "@/slicers/store";
import { COLLECTIONS, getAllDeviceUuids, getAllElementsInCloud, getDeviceUuid, setElementInCloud } from "@/libs/firebase";
import { addLocalCategories, deleteLocalCategories, getCloudCategories } from "@/slicers/categoriesSlice";
import { addLocalNotes, deleteLocalNotes, getCloudNotes } from "@/slicers/notesSlice";
import { getCloudConnected, setCloudConnected, setIsCloudSyncEnabled } from "@/slicers/settingsSlice";
import { addCloudCategoriesAsync, deleteCloudCategoriesAsync } from "@/slicers/thunks/categories";
import { addCloudNotesAsync, deleteCloudNotesAsync } from "@/slicers/thunks/notes";
import { toast } from "@/utils/toast";

const PENDING_CHANGES_DELAY = 10000;
const DEBOUNCE_NOTES_DELAY = 200;

export default function SyncOnProvider(): null {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const tPendingChanges = useRef<ReturnType<typeof setInterval> | null>(null);
  const tDebounceNotes = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToLocalRef = useRef<(() => Promise<void>) | null>(null);
  const isSyncingRef = useRef(false);

  const isCloudConnected = useSelector(getCloudConnected);
  const netInfo = useNetInfo();

  const cloudCategories = useSelector(getCloudCategories);
  const cloudCategories_add = useMemo(() => Object.values(cloudCategories.add), [cloudCategories.add]);
  const cloudCategories_delete = useMemo(() => Object.values(cloudCategories.delete), [cloudCategories.delete]);

  const cloudNotes = useSelector(getCloudNotes);
  const cloudNotes_add = useMemo(() => Object.values(cloudNotes.add), [cloudNotes.add]);
  const cloudNotes_delete = useMemo(() => Object.values(cloudNotes.delete), [cloudNotes.delete]);

  ///////////////////////////////////
  // Pending cloud changes checker
  // syncToLocal - notes & categories
  ///////////////////////////////////

  const syncToLocal = useCallback(async () => {
    // prevent concurrent syncs
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // if no internet connectivity, stop thread
      if (devices == null) {
        if (tPendingChanges.current) clearInterval(tPendingChanges.current);
        return;
      }

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

        // if there is some "add categories" data, put it in the local "add" object
        if (!isObjectEmpty(deviceData.addCategories)) {
          dispatch(addLocalCategories(deviceData.addCategories));
        }

        // if there is some "add notes" data, put it in the local "add" object
        if (!isObjectEmpty(deviceData.addNotes)) {
          dispatch(addLocalNotes(deviceData.addNotes));
        }

        // if there is some "delete notes" data, put it in the local "delete" object
        if (!isObjectEmpty(deviceData.deleteNotes)) {
          dispatch(deleteLocalNotes(deviceData.deleteNotes));
        }

        // if there is some "delete categories" data, put it in the local "delete" object
        if (!isObjectEmpty(deviceData.deleteCategories)) {
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
                  addCategories: {},
                  deleteCategories: {},
                  addNotes: {},
                  deleteNotes: {},
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
  }, [dispatch, t]);

  // keep ref in sync for AppState listener
  useEffect(() => {
    syncToLocalRef.current = syncToLocal;
  }, [syncToLocal]);

  ///////////////////////////////////
  // Pending cloud changes checker
  // syncToLocal - notes & categories
  ///////////////////////////////////

  useEffect(() => {
    if (tPendingChanges.current) clearInterval(tPendingChanges.current);

    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    syncToLocal();
    tPendingChanges.current = setInterval(syncToLocal, PENDING_CHANGES_DELAY);

    return () => {
      if (tPendingChanges.current) clearInterval(tPendingChanges.current);
    };
  }, [isCloudConnected, netInfo, syncToLocal]);

  ///////////////////////////////////
  // AppState listener - sync immediately on foreground resume
  ///////////////////////////////////

  useEffect(() => {
    // on web/tauri, use visibilitychange instead
    if (Platform.OS === "web") {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          syncToLocalRef.current?.();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // app came back to foreground, sync immediately
        syncToLocalRef.current?.();
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
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    // if both groups are empty, call syncToCloud method
    if (isEmpty(cloudCategories_add) && isEmpty(cloudCategories_delete)) {
      return;
    }

    const syncCategoriesToCloud = async () => {
      try {
        const devices = await getAllDeviceUuids();
        const deviceUuid = await getDeviceUuid();

        // if no internet connectivity, return
        if (devices == null) {
          return;
        }

        const devicesExceptMe = devices.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);

        if (!isEmpty(cloudCategories_add)) {
          await dispatch(
            addCloudCategoriesAsync({
              deviceUuid: deviceUuid!,
              devicesToSync: devicesExceptMe,
              areMoreThanOneDevice: devicesExceptMe.length > 0,
            })
          ).unwrap();
        }

        if (!isEmpty(cloudCategories_delete)) {
          await dispatch(
            deleteCloudCategoriesAsync({
              deviceUuid: deviceUuid!,
              devicesToSync: devicesExceptMe,
              areMoreThanOneDevice: devicesExceptMe.length > 0,
            })
          ).unwrap();
        }
      } catch (e) {
        console.log("syncCategoriesToCloud error:", e);
      }
    };

    syncCategoriesToCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudConnected, netInfo, cloudCategories_add, cloudCategories_delete]);

  ///////////////////////////////////
  // Pending local changes checker
  // syncToCloud - notes
  ///////////////////////////////////

  useEffect(() => {
    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    // if both groups are empty, don't call syncToCloud method
    if (isEmpty(cloudNotes_add) && isEmpty(cloudNotes_delete)) {
      return;
    }

    const syncNotesToCloud = async () => {
      try {
        const devices = await getAllDeviceUuids();
        const deviceUuid = await getDeviceUuid();

        // if no internet connectivity, return
        if (devices == null) {
          return;
        }

        const devicesExceptMe = devices.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);

        if (!isEmpty(cloudNotes_add)) {
          await dispatch(
            addCloudNotesAsync({
              deviceUuid: deviceUuid!,
              devicesToSync: devicesExceptMe,
              areMoreThanOneDevice: devicesExceptMe.length > 0,
            })
          ).unwrap();
        }

        if (!isEmpty(cloudNotes_delete)) {
          await dispatch(
            deleteCloudNotesAsync({
              deviceUuid: deviceUuid!,
              devicesToSync: devicesExceptMe,
              areMoreThanOneDevice: devicesExceptMe.length > 0,
            })
          ).unwrap();
        }
      } catch (e) {
        console.log("syncNotesToCloud error:", e);
      }
    };

    if (tDebounceNotes.current) clearTimeout(tDebounceNotes.current);
    tDebounceNotes.current = setTimeout(syncNotesToCloud, DEBOUNCE_NOTES_DELAY);

    return () => {
      if (tDebounceNotes.current) clearTimeout(tDebounceNotes.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudConnected, netInfo, cloudNotes_add, cloudNotes_delete]);

  return null;
}
